// DigestSnap AI helper function.
//
// Required secrets before deployment:
//   npm run ai:secret -- GEMINI_API_KEY=your_key
//   npm run ai:secret -- AI_ALLOWED_ORIGINS=https://your-domain.com,http://localhost:5173
//
// Optional:
//   npm run ai:secret -- GEMINI_MODEL=gemini-2.5-flash
//   npm run ai:secret -- GEMINI_FALLBACK_MODELS=gemini-2.5-flash-lite,gemini-2.0-flash-lite
//   npm run ai:secret -- GEMINI_TIMEOUT_MS=18000
//
// The allowlist keeps this function from becoming a public AI proxy. If
// AI_ALLOWED_ORIGINS is missing, only localhost and 127.0.0.1 are allowed.

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';
const GEMINI_FALLBACK_MODELS = parseModelList(Deno.env.get('GEMINI_FALLBACK_MODELS') ?? 'gemini-2.5-flash-lite,gemini-2.0-flash-lite');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const MAX_PROMPT_LENGTH = 4000;
const MAX_SYSTEM_LENGTH = 1200;
const MAX_IMAGE_BASE64_LENGTH = 7_000_000;
const MAX_JSON_BODY_BYTES = 7_600_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const IMAGE_RATE_LIMIT_MAX_REQUESTS = 8;
const CHAT_MAX_LENGTH = 500;
const GEMINI_TIMEOUT_MS = getBoundedEnvNumber('GEMINI_TIMEOUT_MS', 18_000, 8_000, 25_000);
const SCAN_CACHE_VERSION = 'label-v15-basis-20260627';
const CACHE_READ_TIMEOUT_MS = 900;
const CACHE_WRITE_TIMEOUT_MS = 1_200;
const OPEN_FOOD_FACTS_TIMEOUT_MS = 1_600;
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const BLOCKED_PATTERNS = [
  /\b(kill|suicide|self[-\s]?harm|cut myself|end my life)\b/i,
  /\b(steroid|anabolic|tren|dianabol|illegal drug|cocaine|meth)\b/i,
  /\b(dehydrate|water cut|starve|purge|laxative|vomit to lose)\b/i,
  /\b(hate|slur|nazi|terrorist|bomb|weapon|harass|doxx)\b/i,
  /\b(cheat on|fake a test|forge|steal|hack)\b/i,
];

function parseModelList(value: string) {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ).slice(0, 3);
}

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RequestBody = {
  prompt?: unknown;
  system?: unknown;
  mode?: unknown;
  imageBase64?: unknown;
  labelText?: unknown;
  dishName?: unknown;
  productKey?: unknown;
  userTriggers?: unknown;
  userLang?: unknown;
  mimeType?: unknown;
};

type Rating = 'Safe' | 'Caution' | 'Avoid';
type ScanConfidenceLevel = 'high' | 'medium' | 'low';
type ScanConfidenceSource = 'label_read' | 'visual_estimate' | 'database_match' | 'manual_text' | 'fallback' | 'user_corrected';

type NutritionFacts = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
  sugarG?: number;
  sodiumMg?: number;
};

type ChemicalReport = {
  chemicalName: string;
  severity: Rating;
  reason: string;
};

type ScanConfidence = {
  level: ScanConfidenceLevel;
  source: ScanConfidenceSource;
  score: number;
  label: string;
  detail: string;
};

type ScanPayload = {
  result: {
    productName: string;
    overallRating: Rating;
    score: number;
    nutrition?: NutritionFacts;
    confidence?: ScanConfidence;
    basis?: {
      portionBasis?: string;
      decisionBasis?: string;
    };
    flaggedChemicals: ChemicalReport[];
  };
};

type VisualIdentityPayload = {
  productName: string;
  brand: string;
  category: string;
  confidenceScore: number;
  isFood: boolean;
  visibleText: string;
};

type ProductDatabaseMatch = {
  productName: string;
  brand: string;
  category: string;
  confidenceScore: number;
  nutrition?: NutritionFacts;
};

type ImagePayload = {
  data: string;
  mimeType: string;
  triggers: string[];
};

type FoodTextPayload = {
  inputType: 'label' | 'dish';
  text: string;
  productKey: string;
  triggers: string[];
};

type GeminiTextPart = {
  text?: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiTextPart[];
    };
  }>;
};

const rateLimitBuckets = new Map<string, RateLimitBucket>();

const MAX_FOOD_TEXT_LENGTH = 1800;
const MAX_PRODUCT_KEY_LENGTH = 160;
const MAX_TRIGGER_COUNT = 20;
const MAX_TRIGGER_LENGTH = 40;

type FoodRiskRule = {
  id: string;
  patterns: RegExp[];
  rating: Rating;
  maxScore: number;
  concern: {
    en: string;
    ru: string;
  };
  reason: {
    en: string;
    ru: string;
  };
};

type EverydayFoodRule = {
  id: string;
  patterns: RegExp[];
  excludePatterns?: RegExp[];
  rating: Rating;
  score: number;
  concern: {
    en: string;
    ru: string;
  };
  reason: {
    en: string;
    ru: string;
  };
};

const STRICT_FOOD_RISK_RULES: FoodRiskRule[] = [
  {
    id: 'sugary-drink',
    patterns: [
      /\bfuse\s*tea\b/i,
      /\biced?\s*tea\b/i,
      /\bsweet(?:ened)?\s*tea\b/i,
      /\bsoda\b/i,
      /\bcola\b/i,
      /\bfanta\b/i,
      /\bsprite\b/i,
      /\bpepsi\b/i,
      /\bcoca[-\s]?cola\b/i,
      /\bsoft\s*drink\b/i,
      /\bsweetened\s*juice\b/i,
      /газиров/i,
      /кола/i,
      /сладк\w*\s+напит/i,
      /холодн\w*\s+чай/i,
    ],
    rating: 'Avoid',
    maxScore: 38,
    concern: { en: 'Sugary drink', ru: 'Сладкий напиток' },
    reason: { en: 'High sugar and acidity signal.', ru: 'Сигнал сахара и кислотности.' },
  },
  {
    id: 'energy-drink',
    patterns: [/\benergy\s*drink\b/i, /\bred\s*bull\b/i, /\bmonster\b/i, /\badrenaline\b/i, /\btaurine\b/i, /энергет/i, /кофеин/i, /таурин/i],
    rating: 'Avoid',
    maxScore: 35,
    concern: { en: 'Energy drink', ru: 'Энергетик' },
    reason: { en: 'Caffeine and acidity often irritate.', ru: 'Кофеин и кислоты часто раздражают.' },
  },
  {
    id: 'candy-dessert',
    patterns: [/\bcandy\b/i, /\bsweets?\b/i, /\bchocolate\s*bar\b/i, /\bgummy\b/i, /\bcaramel\b/i, /\btoffee\b/i, /\blollipop\b/i, /конфет/i, /сладост/i, /шоколадн\w*\s+батон/i, /карамел/i],
    rating: 'Avoid',
    maxScore: 42,
    concern: { en: 'Candy or sweets', ru: 'Конфеты или сладости' },
    reason: { en: 'Mostly sugar with low satiety.', ru: 'В основном сахар, мало сытости.' },
  },
  {
    id: 'fried-snack',
    patterns: [/\bchips?\b/i, /\bcrisps?\b/i, /\bcheetos\b/i, /\bdoritos\b/i, /\bpringles\b/i, /\bcrackers?\b/i, /\bdeep[-\s]?fried\b/i, /\bfried\b/i, /\bfries\b/i, /\bfrench\s*fries\b/i, /\bfried\s*chicken\b/i, /\bnuggets?\b/i, /\bcrispy\s*chicken\b/i, /чипс/i, /сухарик/i, /жарен/i, /фри/i, /наггет/i],
    rating: 'Avoid',
    maxScore: 42,
    concern: { en: 'Fried snack', ru: 'Жареный снек' },
    reason: { en: 'Fat, salt, and additives stack.', ru: 'Жир, соль и добавки вместе.' },
  },
  {
    id: 'instant-noodles',
    patterns: [/\binstant\s*noodles?\b/i, /\bramen\b/i, /\bnoodle\s*soup\b/i, /\bseasoning\s*packet\b/i, /лапш\w*\s+быстр/i, /рамен/i, /доширак/i],
    rating: 'Avoid',
    maxScore: 40,
    concern: { en: 'Instant noodles', ru: 'Лапша быстрого приготовления' },
    reason: { en: 'Usually sodium-heavy and additive-heavy.', ru: 'Обычно много соли и добавок.' },
  },
  {
    id: 'processed-meat',
    patterns: [/\bsausage\b/i, /\bsalami\b/i, /\bhot\s*dog\b/i, /\bbologna\b/i, /\bham\b/i, /\bpepperoni\b/i, /\bprocessed\s*meat\b/i, /\bnitrite\b/i, /\bnitrate\b/i],
    rating: 'Caution',
    maxScore: 50,
    concern: { en: 'Processed meat', ru: 'Переработанное мясо' },
    reason: { en: 'Salt and preservatives are common.', ru: 'Часто есть соль и консерванты.' },
  },
  {
    id: 'bakery-pastry',
    patterns: [/\bdonut\b/i, /\bdoughnut\b/i, /\bcroissant\b/i, /\bpastry\b/i, /\bcake\b/i, /\bcookie\b/i, /\bmuffin\b/i, /\bwafer\b/i],
    rating: 'Caution',
    maxScore: 48,
    concern: { en: 'Sweet pastry', ru: 'Сладкая выпечка' },
    reason: { en: 'Sugar, flour, and fat combine.', ru: 'Сахар, мука и жир вместе.' },
  },
  {
    id: 'sugary-cereal',
    patterns: [/\bcereal\b/i, /\bcorn\s*flakes\b/i, /\bchoco\b/i, /\bfrosted\b/i, /\bgranola\b/i, /\bmuesli\b/i],
    rating: 'Caution',
    maxScore: 52,
    concern: { en: 'Sweet cereal', ru: 'Сладкий завтрак' },
    reason: { en: 'Often marketed healthy despite sugar.', ru: 'Часто выглядит полезнее, чем есть.' },
  },
  {
    id: 'heavy-sauce',
    patterns: [/\bmayonnaise\b/i, /\bketchup\b/i, /\bsauce\b/i, /\bdressing\b/i, /\bglucose[-\s]?fructose\b/i, /\bcorn\s*syrup\b/i],
    rating: 'Caution',
    maxScore: 55,
    concern: { en: 'Sauce additives', ru: 'Добавки в соусе' },
    reason: { en: 'Hidden sugar, oils, or acids.', ru: 'Скрытый сахар, масла или кислоты.' },
  },
  {
    id: 'ultra-processed',
    patterns: [/\bultra[-\s]?processed\b/i, /\bflavourings?\b/i, /\bartificial\b/i, /\bpreservatives?\b/i, /\bemulsifiers?\b/i, /\bstabilizers?\b/i, /\bcolour(?:ing)?s?\b/i],
    rating: 'Caution',
    maxScore: 58,
    concern: { en: 'Ultra-processed signals', ru: 'Сигналы ультра-обработки' },
    reason: { en: 'Multiple additives reduce confidence.', ru: 'Много добавок снижает доверие.' },
  },
  {
    id: 'fast-food-meal',
    patterns: [/\bburger\b/i, /\bcheeseburger\b/i, /\bfast\s*food\b/i, /\bshawarma\b/i, /\bkebab\b/i, /\bfried\s*meal\b/i, /\btakeout\b/i, /\btakeaway\b/i],
    rating: 'Avoid',
    maxScore: 44,
    concern: { en: 'Fast-food profile', ru: 'Профиль фастфуда' },
    reason: { en: 'Fat, sodium, and sauces stack.', ru: 'Жир, соль и соусы вместе.' },
  },
];

const EVERYDAY_FOOD_RULES: EverydayFoodRule[] = [
  {
    id: 'plain-water',
    patterns: [/\bwater\b/i, /\bmineral\s*water\b/i, /\bspring\s*water\b/i, /\bborjomi\b/i, /вода/i, /минеральн\w*\s+вод/i, /боржоми/i],
    excludePatterns: [/\bsweet(?:ened)?\b/i, /\bflavou?r(?:ed)?\b/i, /\bjuice\b/i, /\bsoda\b/i, /сладк/i, /сок/i, /газировк/i],
    rating: 'Safe',
    score: 90,
    concern: { en: 'Hydration', ru: 'Гидратация' },
    reason: { en: 'Plain water is usually low-trigger.', ru: 'Обычно низкий риск реакции.' },
  },
  {
    id: 'avocado',
    patterns: [/\bavocados?\b/i, /авокадо/i],
    excludePatterns: [/\bfried\b/i, /\bsauce\b/i, /\bdressing\b/i, /жарен/i, /соус/i],
    rating: 'Safe',
    score: 84,
    concern: { en: 'Whole food', ru: 'Цельный продукт' },
    reason: { en: 'Fiber and fats can feel heavy.', ru: 'Клетчатка и жиры могут утяжелять.' },
  },
  {
    id: 'eggs',
    patterns: [/\beggs?\b/i, /\bboiled\s*egg\b/i, /\bomelette\b/i, /яйц/i, /омлет/i],
    excludePatterns: [/\bfried\b/i, /\bmayonnaise\b/i, /жарен/i, /майонез/i],
    rating: 'Safe',
    score: 86,
    concern: { en: 'Simple protein', ru: 'Простой белок' },
    reason: { en: 'Usually clear and easy to track.', ru: 'Обычно простой и понятный продукт.' },
  },
  {
    id: 'plain-meat',
    patterns: [/\bsteak\b/i, /\bbeef\b/i, /\blamb\b/i, /\bmeat\b/i, /говядин/i, /мясо/i, /баранин/i],
    excludePatterns: [/\bsausage\b/i, /\bsalami\b/i, /\bprocessed\b/i, /\bfried\b/i, /колбас/i, /сосиск/i, /жарен/i],
    rating: 'Safe',
    score: 80,
    concern: { en: 'Plain protein', ru: 'Простой белок' },
    reason: { en: 'Best read when sauce is separate.', ru: 'Лучше оценивать без соуса.' },
  },
  {
    id: 'plain-poultry',
    patterns: [/\bchicken\b/i, /\bturkey\b/i, /\bgrilled\s*chicken\b/i, /куриц/i, /индейк/i],
    excludePatterns: [/\bfried\b/i, /\bcrispy\b/i, /\bnuggets?\b/i, /\bburger\b/i, /жарен/i, /наггет/i],
    rating: 'Safe',
    score: 84,
    concern: { en: 'Lean protein', ru: 'Нежирный белок' },
    reason: { en: 'Usually steady if not fried.', ru: 'Обычно спокойно, если не жареное.' },
  },
  {
    id: 'fish-seafood',
    patterns: [/\bfish\b/i, /\bsalmon\b/i, /\btuna\b/i, /\bshrimp\b/i, /\bseafood\b/i, /рыб/i, /лосос/i, /тунец/i, /кревет/i],
    excludePatterns: [/\bfried\b/i, /\bbreaded\b/i, /жарен/i, /паниров/i],
    rating: 'Safe',
    score: 86,
    concern: { en: 'Protein and fats', ru: 'Белок и жиры' },
    reason: { en: 'Usually clean when grilled or plain.', ru: 'Обычно чисто без панировки.' },
  },
  {
    id: 'rice-grains',
    patterns: [/\brice\b/i, /\bbuckwheat\b/i, /\boats?\b/i, /\boatmeal\b/i, /гречк/i, /рис/i, /овсян/i],
    excludePatterns: [/\bfried\s*rice\b/i, /\bsugar\b/i, /\bsyrup\b/i, /жарен\w*\s+рис/i, /сахар/i],
    rating: 'Safe',
    score: 82,
    concern: { en: 'Simple base food', ru: 'Простая база' },
    reason: { en: 'Easy baseline for pattern tracking.', ru: 'Удобная база для паттернов.' },
  },
  {
    id: 'pasta-macaroni',
    patterns: [/\bpasta\b/i, /\bmacaroni\b/i, /\bspaghetti\b/i, /\bnoodles?\b/i, /макарон/i, /паст[аы]/i, /спагетти/i],
    excludePatterns: [/\binstant\b/i, /\bramen\b/i, /\bcream\s*sauce\b/i, /быстрого\s+приготов/i, /сливочн\w*\s+соус/i],
    rating: 'Caution',
    score: 64,
    concern: { en: 'Wheat base', ru: 'Пшеничная база' },
    reason: { en: 'Fine for some, heavy for others.', ru: 'Кому-то нормально, кому-то тяжело.' },
  },
  {
    id: 'bread-bakery-base',
    patterns: [/\bbread\b/i, /\btoast\b/i, /\bbun\b/i, /\bwrap\b/i, /\bpita\b/i, /хлеб/i, /тост/i, /лаваш/i, /булоч/i],
    excludePatterns: [/\bcake\b/i, /\bcookie\b/i, /\bpastry\b/i, /\bsweet\b/i, /торт/i, /печень/i, /сладк/i],
    rating: 'Caution',
    score: 62,
    concern: { en: 'Wheat or flour', ru: 'Пшеница или мука' },
    reason: { en: 'Common repeat trigger for bloating.', ru: 'Частый повторный триггер вздутия.' },
  },
  {
    id: 'plain-potato',
    patterns: [/\bpotatoes?\b/i, /\bbaked\s*potato\b/i, /\bmashed\s*potato\b/i, /картоф/i],
    excludePatterns: [/\bfries\b/i, /\bfried\b/i, /\bchips?\b/i, /\bcrisps?\b/i, /жарен/i, /фри/i, /чипс/i],
    rating: 'Safe',
    score: 78,
    concern: { en: 'Simple starch', ru: 'Простой крахмал' },
    reason: { en: 'Usually clear unless fried.', ru: 'Обычно понятно, если не жареное.' },
  },
  {
    id: 'beans-legumes',
    patterns: [/\bbeans?\b/i, /\blentils?\b/i, /\bchickpeas?\b/i, /\bpeas?\b/i, /фасол/i, /чечевиц/i, /нут/i, /горох/i],
    rating: 'Caution',
    score: 58,
    concern: { en: 'High-fiber legumes', ru: 'Бобовые с клетчаткой' },
    reason: { en: 'Can bloat sensitive stomachs.', ru: 'Может вздувать чувствительный желудок.' },
  },
  {
    id: 'dairy',
    patterns: [/\bmilk\b/i, /\byog(?:h)?urt\b/i, /\bcheese\b/i, /\bkefir\b/i, /\bcottage\s*cheese\b/i, /молок/i, /йогурт/i, /сыр/i, /кефир/i, /творог/i],
    excludePatterns: [/\bsugar\b/i, /\bsweet(?:ened)?\b/i, /\bice\s*cream\b/i, /сахар/i, /сладк/i, /морожен/i],
    rating: 'Caution',
    score: 60,
    concern: { en: 'Dairy', ru: 'Молочные продукты' },
    reason: { en: 'Common trigger if lactose-sensitive.', ru: 'Частый триггер при лактозе.' },
  },
  {
    id: 'fruit',
    patterns: [/\bbanana\b/i, /\bapple\b/i, /\borange\b/i, /\bberries?\b/i, /\bstrawberries?\b/i, /\bgrapes?\b/i, /\bkiwi\b/i, /банан/i, /яблок/i, /апельсин/i, /ягод/i, /клубник/i, /виноград/i, /киви/i],
    excludePatterns: [/\bjuice\b/i, /\bsmoothie\b/i, /\bsyrup\b/i, /\bcandy\b/i, /сок/i, /смузи/i, /сироп/i],
    rating: 'Safe',
    score: 90,
    concern: { en: 'Whole fruit', ru: 'Цельный фрукт' },
    reason: { en: 'Simple whole food with fiber.', ru: 'Простой цельный продукт с клетчаткой.' },
  },
  {
    id: 'vegetables',
    patterns: [/\bvegetables?\b/i, /\bsalad\b/i, /\bcucumber\b/i, /\btomato\b/i, /\bcarrot\b/i, /\bbroccoli\b/i, /\bspinach\b/i, /овощ/i, /салат/i, /огур/i, /помидор/i, /томат/i, /морков/i, /брокколи/i, /шпинат/i],
    excludePatterns: [/\bfried\b/i, /\bdeep[-\s]?fried\b/i, /\bmayonnaise\b/i, /жарен/i, /майонез/i],
    rating: 'Safe',
    score: 86,
    concern: { en: 'Whole vegetable', ru: 'Цельный овощ' },
    reason: { en: 'Usually a strong baseline food.', ru: 'Обычно хорошая базовая еда.' },
  },
  {
    id: 'onion-garlic',
    patterns: [/\bonion\b/i, /\bgarlic\b/i, /лук/i, /чеснок/i],
    rating: 'Caution',
    score: 50,
    concern: { en: 'FODMAP aromatics', ru: 'FODMAP ароматические продукты' },
    reason: { en: 'Often bothers sensitive digestion.', ru: 'Часто беспокоит чувствительный ЖКТ.' },
  },
  {
    id: 'nuts-seeds',
    patterns: [/\bnuts?\b/i, /\balmonds?\b/i, /\bpeanuts?\b/i, /\bcashews?\b/i, /\bseeds?\b/i, /орех/i, /миндаль/i, /арахис/i, /кешью/i, /семеч/i],
    rating: 'Caution',
    score: 68,
    concern: { en: 'Dense fats', ru: 'Плотные жиры' },
    reason: { en: 'Healthy, but easy to overdo.', ru: 'Полезно, но легко переборщить.' },
  },
  {
    id: 'coffee',
    patterns: [/\bcoffee\b/i, /\bespresso\b/i, /\blatte\b/i, /\bamericano\b/i, /кофе/i, /эспрессо/i, /латте/i],
    rating: 'Caution',
    score: 56,
    concern: { en: 'Caffeine', ru: 'Кофеин' },
    reason: { en: 'Can irritate sensitive stomachs.', ru: 'Может раздражать чувствительный желудок.' },
  },
  {
    id: 'juice-smoothie',
    patterns: [/\bjuice\b/i, /\bsmoothie\b/i, /сок/i, /смузи/i],
    rating: 'Caution',
    score: 54,
    concern: { en: 'Liquid sugar', ru: 'Жидкий сахар' },
    reason: { en: 'Less filling than whole fruit.', ru: 'Менее сытно, чем цельный фрукт.' },
  },
];

declare const EdgeRuntime: { waitUntil?: (promise: Promise<unknown>) => void } | undefined;

function runAfterResponse(promise: Promise<unknown>) {
  if (typeof EdgeRuntime !== 'undefined' && typeof EdgeRuntime.waitUntil === 'function') {
    EdgeRuntime.waitUntil(promise);
    return;
  }

  promise.catch((error) => console.error('Background task failed.', error));
}

function getBoundedEnvNumber(name: string, fallback: number, min: number, max: number) {
  const rawValue = Deno.env.get(name);
  const numberValue = rawValue ? Number(rawValue) : fallback;

  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.round(numberValue)));
}

function getAllowedOrigins() {
  return (Deno.env.get('AI_ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isLocalOrigin(origin: string) {
  return /^http:\/\/localhost(?::\d+)?$/.test(origin) || /^http:\/\/127\.0\.0\.1(?::\d+)?$/.test(origin);
}

function isOriginAllowed(origin: string | null) {
  if (!origin) {
    return false;
  }

  const allowedOrigins = getAllowedOrigins();

  if (allowedOrigins.length === 0) {
    return isLocalOrigin(origin);
  }

  return allowedOrigins.includes(origin);
}

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin');
  const allowedOrigin = isOriginAllowed(origin) ? origin : 'null';

  return {
    'Access-Control-Allow-Origin': allowedOrigin ?? 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'OPTIONS, POST',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json',
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff',
  };
}

function jsonResponse(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: getCorsHeaders(req),
  });
}

function isRequestBodyTooLarge(req: Request) {
  const contentLength = req.headers.get('content-length');

  if (!contentLength) {
    return false;
  }

  const bytes = Number(contentLength);

  return Number.isFinite(bytes) && bytes > MAX_JSON_BODY_BYTES;
}

function getClientKey(req: Request, scope: string) {
  const origin = req.headers.get('origin') ?? 'unknown-origin';
  const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown-ip';
  return `${scope}:${origin}:${forwardedFor}`;
}

function isRateLimited(req: Request, scope: string, maxRequests: number) {
  const now = Date.now();
  const key = getClientKey(req, scope);
  const bucket = rateLimitBuckets.get(key);

  for (const [bucketKey, value] of rateLimitBuckets.entries()) {
    if (value.resetAt <= now) {
      rateLimitBuckets.delete(bucketKey);
    }
  }

  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return false;
  }

  bucket.count += 1;
  return bucket.count > maxRequests;
}

function getSafetyBlockReason(text: string, mode: string) {
  if (mode === 'chat' && text.length > CHAT_MAX_LENGTH + 2500) {
    return 'Chat request is too long.';
  }

  if (BLOCKED_PATTERNS.some((pattern) => pattern.test(text))) {
    return 'DigestSnap AI cannot help with harmful, illegal, hateful, or unsafe requests.';
  }

  return '';
}

async function readJsonBody(req: Request): Promise<RequestBody | null> {
  try {
    const value: unknown = await req.json();
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeLanguage(value: unknown) {
  if (typeof value !== 'string') {
    return 'English';
  }

  const cleaned = value.trim();

  if (/^(ru|rus|russian|русский)$/i.test(cleaned)) {
    return 'Russian';
  }

  if (/^(en|eng|english)$/i.test(cleaned)) {
    return 'English';
  }

  return /^[\p{L}\s-]{2,40}$/u.test(cleaned) ? cleaned : 'English';
}

function parseImagePayload(body: RequestBody): { payload?: ImagePayload; error?: string } {
  if (typeof body.imageBase64 !== 'string' || !body.imageBase64.trim()) {
    return { error: 'Image data is required.' };
  }

  const rawImage = body.imageBase64.trim();
  const dataUrlMatch = rawImage.match(/^data:(image\/[a-z0-9.+-]+);base64,(.*)$/is);
  const requestedMimeType = typeof body.mimeType === 'string' ? body.mimeType.trim().toLowerCase() : '';
  const mimeType = (dataUrlMatch?.[1] ?? (requestedMimeType || 'image/jpeg')).toLowerCase();
  const base64 = (dataUrlMatch?.[2] ?? rawImage).replace(/\s/g, '');

  if (!SUPPORTED_IMAGE_TYPES.has(mimeType)) {
    return { error: 'Only JPEG, PNG, and WebP images are supported.' };
  }

  if (base64.length > MAX_IMAGE_BASE64_LENGTH) {
    return { error: 'Image is too large. Please upload a smaller or more compressed image.' };
  }

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 !== 0) {
    return { error: 'Image data must be valid base64.' };
  }

  return { payload: { data: base64, mimeType, triggers: parseUserTriggers(body.userTriggers) } };
}

function parseUserTriggers(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, MAX_TRIGGER_COUNT)
        .map((value) => value.slice(0, MAX_TRIGGER_LENGTH))
    : [];
}

function parseFoodTextPayload(body: RequestBody): { payload?: FoodTextPayload; error?: string } {
  const rawLabelText = typeof body.labelText === 'string' ? body.labelText.trim() : '';
  const rawDishName = typeof body.dishName === 'string' ? body.dishName.trim() : '';
  const inputType = rawLabelText ? 'label' : 'dish';
  const text = (rawLabelText || rawDishName).replace(/\s+/g, ' ').slice(0, MAX_FOOD_TEXT_LENGTH);

  if (!text) {
    return { error: 'Label text or dish name is required.' };
  }

  const rawProductKey = typeof body.productKey === 'string' ? body.productKey.trim() : text;
  const productKey = rawProductKey.replace(/\s+/g, ' ').slice(0, MAX_PRODUCT_KEY_LENGTH);
  const triggers = parseUserTriggers(body.userTriggers);

  return {
    payload: {
      inputType,
      text,
      productKey,
      triggers,
    },
  };
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function makeGeminiUrl(model = GEMINI_MODEL) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(
    GEMINI_API_KEY ?? '',
  )}`;
}

async function callGemini(body: unknown) {
  const models = Array.from(new Set([GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS]));
  let lastError: { error: string; status: number } = { error: 'AI request failed.', status: 502 };
  let sawQuota = false;

  for (const model of models) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

    try {
      const response = await fetch(makeGeminiUrl(model), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error('Gemini request failed.', model, response.status, errorText.slice(0, 500));
        const quotaHit = response.status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(errorText);
        sawQuota ||= quotaHit;
        lastError = {
          error: quotaHit ? 'AI quota is cooling down. Trying another model.' : 'AI request failed.',
          status: quotaHit ? 429 : 502,
        };
        continue;
      }

      const data = (await response.json()) as GeminiResponse;
      const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim() ?? '';

      if (!text) {
        lastError = { error: 'AI returned an empty response.', status: 502 };
        continue;
      }

      return { text };
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === 'AbortError';
      lastError = { error: isTimeout ? 'AI request timed out.' : 'AI request failed.', status: isTimeout ? 504 : 502 };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return sawQuota ? { error: 'AI quota is cooling down. Try again shortly.', status: 429 } : lastError;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function handleTextRequest(req: Request, body: RequestBody) {
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  const system = typeof body.system === 'string' ? body.system.trim() : '';
  const mode = body.mode === 'chat' ? 'chat' : 'plan';

  if (!prompt) {
    return jsonResponse(req, { error: 'Prompt is required.' }, 400);
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return jsonResponse(req, { error: 'Prompt is too long.' }, 400);
  }

  if (system.length > MAX_SYSTEM_LENGTH) {
    return jsonResponse(req, { error: 'System message is too long.' }, 400);
  }

  const safetyBlockReason = getSafetyBlockReason(prompt, mode);

  if (safetyBlockReason) {
    return jsonResponse(req, { error: safetyBlockReason, blocked: true }, 400);
  }

  const geminiResult = await callGemini({
    systemInstruction: system ? { parts: [{ text: system }] } : undefined,
    contents: [{ parts: [{ text: prompt }] }],
  });

  if ('error' in geminiResult) {
    return jsonResponse(req, { error: geminiResult.error }, geminiResult.status);
  }

  return jsonResponse(req, { text: geminiResult.text });
}

function makeLabelPrompt(targetLang: string, triggers: string[] = []) {
  const triggerLine = triggers.length > 0 ? triggers.join(', ') : 'none provided';

  return `You are DigestSnap's strict food vision scanner.

First identify what is in the image visually. Then read/OCR every visible label word you can.
You must always try visual recognition before giving up.
If the image clearly shows any food, drink, package, bottle, can, bar, fruit, vegetable, cooked meal, snack, or label, the scan is valid even when OCR is weak.
There are two valid scan types:
1. Packaged product scan: use brand, logo, packaging, visible label text, nutrition facts, and ingredients.
2. Whole food scan: if the image shows unpackaged basic food, do not search for a label. Identify it by shape, color, texture, and serving context.
If the label text is blurry, blocked, tiny, or unreadable, do NOT return "Unreadable Label", "Image unclear", or "Could not verify image" unless the image contains no recognizable food/product at all.
Instead, use visual food/product recognition from the image itself: packaging shape, brand colors, visible food, drink type, category, container, serving style, restaurant/takeout cues, and common similar products. Return a cautious visual estimate with a productName like "Avocado", "Eggs", "Macaroni", "Chicken breast", "Likely iced tea drink", "Likely fried snack", "Likely chocolate bar", "Likely burger meal", "Likely fried chicken plate", "Likely soda bottle", or "Likely packaged sauce".

Analyze visible text, branding, nutrition facts, ingredients, and visual product category. Extract the product name when readable; otherwise extract the best visual classification. Then rate possible gut-trigger quality for a normal consumer and for the user's trigger profile.
User possible triggers and profile context: ${triggerLine}

Rules:
- Return JSON only.
- Use ${targetLang} for human-facing strings: productName, chemicalName, and reason.
- If ${targetLang} is Russian, productName, chemicalName, and reason MUST be natural Russian Cyrillic text. Keep brand names in Latin only when they are actual brand names.
- Keep enum values exactly as English strings: "Safe", "Caution", or "Avoid".
- Forbidden productName values unless there is truly no food or drink visible: "Unreadable Label", "Image check error", "Image unclear", "Could not verify image", "Visual estimate unavailable", "Unknown product".
- If brand/name is visible in any language, transliterate or preserve the brand. Example: Russian "молочный ломтик" with Kinder logo should become "Kinder Молочный ломтик", not an error.
- Do not invent ingredients that are not visible, but use strong product-category inference when ingredients are hidden.
- You are not just OCR. Use logo shape, colors, bottle/can/bag design, mascot, typography fragments, and common product knowledge to identify global packaged foods and drinks.
- For common packaged products, prefer a specific product identity when visually supported: e.g. "Coca-Cola", "Pepsi", "Sprite", "Fanta", "Red Bull", "Monster Energy", "Lay's potato chips", "Doritos", "Cheetos", "Pringles", "Snickers", "Kinder Bueno".
- If the exact brand is not clear, say "Likely [category]" rather than "Unreadable Label".
- If the image shows everyday unpackaged food, identify the food directly. Examples: avocado, eggs, beef, chicken, fish, rice, macaroni/pasta, bread, potatoes, beans, milk, yogurt, banana, apple, cucumber, tomato, salad, nuts, coffee.
- For whole foods, use concerns/signals rather than fake chemicals. Good signal names: "Whole food", "Simple protein", "Wheat base", "Dairy", "High fiber", "Caffeine", "Fried preparation", "Sauce not visible".
- Plain whole fruits like apple, banana, orange, berries, grapes, or kiwi are "Safe" with score 88-94 unless juiced, candied, syruped, sauced, or matching a user trigger.
- Vegetables, plain eggs, plain meat/fish/chicken, rice, oats, buckwheat, and plain potatoes are usually "Safe" with score 75-92 unless fried, sauced, sweetened, or matching a user trigger.
- Pasta/macaroni, bread/wraps, dairy, beans/lentils, nuts, coffee, and juice are usually "Caution" with score 50-70 because they are common repeat triggers for some users.
- If OCR is unreadable but the food/product category is visually recognizable, return the likely category and mark concerns as "visual estimate", "label not verified", or "category-based risk".
- If both label text and visual category are impossible to identify, return productName as "Visual estimate unavailable" and overallRating as "Caution".
- Never leave productName generic if any food/drink/package category is visible.
- If you can identify only category, productName must be "Likely [specific category]" in ${targetLang}, e.g. "Likely chocolate dairy snack", "Likely avocado", "Likely bottled water", "Likely chips".
- For flaggedChemicals, return 2 to 4 ingredients/additives/category concerns.
- Estimate nutrition for one normal serving or one visible package when possible. Use nutrition facts if visible; otherwise make a conservative category estimate.
- nutrition numbers must be realistic non-negative numbers. calories are kcal, proteinG/carbsG/fatG/fiberG/sugarG are grams, sodiumMg is milligrams.
- Always include basis.portionBasis and basis.decisionBasis. portionBasis must say the serving assumption in plain words. decisionBasis must say what evidence was used: visible label, database/product identity, visual estimate, or category estimate.
- If a visible or strongly inferable ingredient overlaps with user possible triggers, prioritize it as a concern.
- Sugary tea, iced tea, soda, cola, energy drink, sweetened juice, and carbonated soft drinks are never "Safe"; they are at least "Caution".
- If visible sugar is high, or the product is a sweetened beverage, score must be 0-45.
- Major "Avoid" categories: sugary soda/iced tea, energy drinks, candy, fried chips/crisps, instant noodles, deep-fried snacks.
- Major visible "Avoid" foods even without OCR: burger meals, fries, fried chicken, deep-fried snacks, soda/iced tea bottles, candy bars, chips/crisps.
- Major "Caution" categories: processed meats, sweet pastries, sugary cereals/granola, heavy sauces, additive-heavy ultra-processed foods.
- If the image appears to show plain bottled water, mineral water, spring water, or a water label, classify it as bottled water/mineral water, not unreadable. Plain or mineral water is usually "Safe" with score 82-95 unless sugar, sweeteners, flavoring, or non-water additives are visible/inferred. Carbonation alone is not a soda signal.
- If the product is soda/energy drink/sweetened tea with sugar, caffeine, acid, sweeteners, or preservatives, use "Avoid".
- Only use "Safe" above 75 when the label clearly shows a simple, low-trigger product with no meaningful additives/sugar concerns.
- Use "Avoid" for obvious strong trigger products: sugary soda/energy drinks, very high sugar, fried snacks, or user-trigger overlap.
- For unclear images, do not pretend certainty. Use "likely", "visual estimate", or "label not verified" in reasons.
- Keep each reason under 12 words.
- This is consumer information, not medical advice.

Return this exact shape:
{
  "result": {
    "productName": "Name or classification",
    "overallRating": "Caution",
    "score": 45,
    "nutrition": {
      "calories": 220,
      "proteinG": 6,
      "carbsG": 28,
      "fatG": 9,
      "fiberG": 2,
      "sugarG": 12,
      "sodiumMg": 240
    },
    "basis": {
      "portionBasis": "One visible package or normal serving",
      "decisionBasis": "Visible label and product category"
    },
    "flaggedChemicals": [
      {
        "chemicalName": "Visible or inferred concern",
        "severity": "Caution",
        "reason": "Brief factual reason."
      }
    ]
  }
}`;
}

function makeVisualRescuePrompt(targetLang: string, triggers: string[] = []) {
  const triggerLine = triggers.length > 0 ? triggers.join(', ') : 'none provided';

  return `You are DigestSnap's visual food recognition fallback.

The previous scan was too uncertain. Ignore OCR perfection and identify the visible food/drink/package from image appearance.
Use packaging, color, logo fragments, shape, container, visible food texture, and common product knowledge.
If any food, drink, snack, candy, meal, bottle, package, fruit, vegetable, egg, meat, pasta, bread, dairy, chips, soda, tea, water, or bar is visible, return a usable estimate.
Do not return unreadable, unknown, not checked, or visual estimate unavailable unless there is no food/drink/product visible at all.
User triggers: ${triggerLine}

Language:
- Use ${targetLang} for productName, chemicalName, and reason.
- If ${targetLang} is Russian, write natural Cyrillic for generic food names and reasons. Keep real brand names as written.
- Keep overallRating and severity exactly "Safe", "Caution", or "Avoid".

Scoring:
- Plain water/mineral water: Safe 82-95.
- Plain whole fruits like apple, banana, orange, berries, grapes, or kiwi: Safe 88-94 unless juiced/candied/syruped/sauced.
- Vegetables/eggs/plain meat/fish/rice/oats/potato: Safe 75-92 unless fried/sauced/sweetened.
- Pasta/bread/dairy/nuts/coffee/juice: Caution 50-70.
- Soda/sweet tea/energy drinks/chips/candy/fried fast food: Avoid 0-45.
- If uncertain but a category is visible, use Caution 45-60.
- Estimate nutrition for one normal serving or one visible package. Return calories, proteinG, carbsG, fatG, and optionally fiberG, sugarG, sodiumMg.
- Always include basis.portionBasis and basis.decisionBasis.

Return JSON only:
{"result":{"productName":"Specific visual estimate","overallRating":"Caution","score":55,"nutrition":{"calories":220,"proteinG":6,"carbsG":28,"fatG":9,"fiberG":2,"sugarG":12,"sodiumMg":240},"basis":{"portionBasis":"One normal serving","decisionBasis":"Visual food recognition and category estimate"},"flaggedChemicals":[{"chemicalName":"Visual estimate","severity":"Caution","reason":"Label not verified"},{"chemicalName":"Category risk","severity":"Caution","reason":"Based on visible product type"}]}}`;
}

function makeVisualIdentityPrompt(targetLang: string) {
  return `Identify the visible food or drink product in this image before doing any health rating.
Use branding, logos, package colors, visible text in any language, food shape, bottle shape, wrapper design, and common product knowledge.
If the image shows a food, drink, snack, fruit, vegetable, meal, bottle, wrapper, can, or packaged product, isFood must be true.
Do not call it unreadable if a product or food category is visually clear.
For Russian or Cyrillic labels, preserve brand names and translate/transliterate the product naturally.
Use ${targetLang} for productName and category when they are generic food names. Keep actual brands as written.

Return only this JSON:
{"productName":"specific visible product or likely food name","brand":"brand or Generic","category":"food category","confidenceScore":90,"isFood":true,"visibleText":"short visible text you used"}`;
}

function makeIdentityRiskPrompt(identity: VisualIdentityPayload, targetLang: string, triggers: string[] = []) {
  const triggerLine = triggers.length > 0 ? triggers.join(', ') : 'none provided';

  return `You are DigestSnap AI. Rate possible gut-trigger risk from a visually identified food item.
Return one JSON object only.

Visual identity:
- productName: ${identity.productName}
- brand: ${identity.brand}
- category: ${identity.category}
- visibleText: ${identity.visibleText || 'none'}
- confidenceScore: ${identity.confidenceScore}
- user possible triggers: ${triggerLine}

Rules:
- Use ${targetLang} for productName, chemicalName, and reason. Keep real brand names as written.
- Keep rating enums exactly "Safe", "Caution", or "Avoid".
- Plain water/mineral water: Safe 82-95.
- Plain whole fruits like apple, banana, orange, berries, grapes, or kiwi: Safe 88-94 unless juiced/candied/syruped/sauced.
- Vegetables/eggs/plain meat/fish/rice/oats/potatoes: Safe 75-92 unless fried/sauced/sweetened.
- Pasta/bread/dairy/nuts/coffee/juice: Caution 50-70.
- Candy/chocolate bars/sweet dairy snacks/sugary drinks/chips/fried fast food: Avoid 0-45.
- If a user trigger overlaps with the identity, lower the score.
- Estimate nutrition for one normal serving or one visible package. Return calories, proteinG, carbsG, fatG, and optionally fiberG, sugarG, sodiumMg.
- Always include basis.portionBasis and basis.decisionBasis.
- Reasons under 12 words.

Return exactly:
{"result":{"productName":"Specific name","overallRating":"Caution","score":55,"nutrition":{"calories":220,"proteinG":6,"carbsG":28,"fatG":9,"fiberG":2,"sugarG":12,"sodiumMg":240},"basis":{"portionBasis":"One normal serving","decisionBasis":"Visual identity and category risk rules"},"flaggedChemicals":[{"chemicalName":"Concern","severity":"Caution","reason":"Short reason"}]}}`;
}

function makeFoodTextPrompt(payload: FoodTextPayload, targetLang: string) {
  const triggerLine = payload.triggers.length > 0 ? payload.triggers.join(', ') : 'none provided';

  return `You are DigestSnap AI. Return one minified JSON object only. Do not include markdown, prose, code fences, or commentary.

Task: rate likely food-trigger risk from ${payload.inputType === 'label' ? 'ingredient label text' : 'a restaurant dish name'}.
Input: ${payload.text}
User triggers: ${triggerLine}

Rules:
- Use ${targetLang} for productName, chemicalName, and reason.
- If ${targetLang} is Russian, productName, chemicalName, and reason MUST be natural Russian Cyrillic text. Keep brand names in Latin only when they are actual brand names.
- Keep enum values exactly: "Safe", "Caution", "Avoid".
- "Safe" means low likely trigger risk, "Caution" means medium, "Avoid" means high.
- Basic whole foods should not be treated like unreadable labels. Eggs, plain meat, plain fish, rice, oats, buckwheat, fruit, vegetables, plain potatoes, and water are usually Safe unless fried, sauced, sweetened, or matching a user trigger.
- Pasta/macaroni, bread/wraps, dairy, beans/lentils, nuts, coffee, and juice are usually Caution because they can be repeat triggers for some users.
- Sugary tea, iced tea, soda, cola, energy drink, sweetened juice, and carbonated soft drinks are never "Safe"; score them 0-55 unless clearly unsweetened.
- Major "Avoid" categories: sugary soda/iced tea, energy drinks, candy, fried chips/crisps, instant noodles, deep-fried snacks.
- Major "Caution" categories: processed meats, sweet pastries, sugary cereals/granola, heavy sauces, additive-heavy ultra-processed foods.
- For soda/energy drink/sweetened tea, flag sugar/caffeine/acidity/sweeteners/preservatives when relevant.
- Do not diagnose, guarantee safety, or give medical advice.
- Return 2 to 4 flaggedChemicals.
- Estimate nutrition for one normal serving or one package from the input/category. Return calories, proteinG, carbsG, fatG, and optionally fiberG, sugarG, sodiumMg.
- Always include basis.portionBasis and basis.decisionBasis.
- Each reason must be under 12 words.
- Prefer common trigger groups: dairy, wheat/flour, fried food, soda, caffeine, onion, garlic, spicy food.

Required JSON shape:
{"result":{"productName":"Food name","overallRating":"Caution","score":45,"nutrition":{"calories":220,"proteinG":6,"carbsG":28,"fatG":9,"fiberG":2,"sugarG":12,"sodiumMg":240},"basis":{"portionBasis":"One normal serving or package","decisionBasis":"Typed food or label text"},"flaggedChemicals":[{"chemicalName":"Trigger","severity":"Caution","reason":"Short reason."},{"chemicalName":"Trigger","severity":"Caution","reason":"Short reason."}]}}`;
}

async function handleFoodTextScanRequest(req: Request, body: RequestBody) {
  const foodText = parseFoodTextPayload(body);

  if (foodText.error || !foodText.payload) {
    return jsonResponse(req, { error: foodText.error ?? 'Invalid food text.' }, 400);
  }

  const targetLang = normalizeLanguage(body.userLang);
  const cacheHash = await sha256Hex(
    `${SCAN_CACHE_VERSION}:food-text:${targetLang}:${foodText.payload.inputType}:${foodText.payload.productKey}:${foodText.payload.text}:${foodText.payload.triggers.join('|')}`,
  );
  const cachedScan = await readCachedScan(cacheHash, targetLang);

  if (cachedScan) {
    if (!isUnusableVisualScan(cachedScan)) {
      return jsonResponse(req, cachedScan);
    }
  }

  const geminiResult = await callGemini({
    contents: [{ parts: [{ text: makeFoodTextPrompt(foodText.payload, targetLang) }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
      maxOutputTokens: 360,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  if ('error' in geminiResult) {
    return jsonResponse(req, withScanConfidence(fallbackFoodTextPayload(foodText.payload, targetLang), targetLang, 'manual_text'), 200);
  }

  const parsed = parseModelJson(geminiResult.text);
  const foodFallback = fallbackFoodTextPayload(foodText.payload, targetLang);
  const scan = normalizeScanPayload(parsed, targetLang, foodFallback);
  const finalScan = await enrichWithProductDatabase(
    withScanConfidence(isUnreadableProductName(scan.result.productName) ? foodFallback : scan, targetLang, 'manual_text'),
    targetLang,
  );

  runAfterResponse(cacheScan(cacheHash, targetLang, finalScan));

  return jsonResponse(req, finalScan);
}

async function handleImageRequest(req: Request, body: RequestBody) {
  const image = parseImagePayload(body);

  if (image.error || !image.payload) {
    return jsonResponse(req, { error: image.error ?? 'Invalid image.' }, 400);
  }

  const targetLang = normalizeLanguage(body.userLang);
  const imageHash = await sha256Hex(`${image.payload.mimeType}:${image.payload.data}`);
  const profileHash = image.payload.triggers.join('|');
  const cacheKey = await sha256Hex(`${SCAN_CACHE_VERSION}:image:${imageHash}:${targetLang}:${profileHash || 'no-profile'}`);
  const cachedScan = await readCachedScan(cacheKey, targetLang);

  if (cachedScan) {
    if (!isUnusableVisualScan(cachedScan)) {
      return jsonResponse(req, cachedScan);
    }
  }

  const identityScan = await identifyAndRateVisibleFood(image.payload, targetLang);

  if (identityScan && !isUnusableVisualScan(identityScan)) {
    const enrichedIdentityScan = await enrichWithProductDatabase(identityScan, targetLang);
    runAfterResponse(cacheScan(cacheKey, targetLang, enrichedIdentityScan));
    return jsonResponse(req, enrichedIdentityScan);
  }

  const geminiResult = await callGemini({
    contents: [
      {
        parts: [
          { text: makeLabelPrompt(targetLang, image.payload.triggers) },
          {
            inlineData: {
              mimeType: image.payload.mimeType,
              data: image.payload.data,
            },
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
      maxOutputTokens: 640,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  if ('error' in geminiResult) {
    return jsonResponse(req, { error: geminiResult.error }, geminiResult.status);
  }

  const parsed = parseModelJson(geminiResult.text);
  let scan = withScanConfidence(normalizeScanPayload(parsed, targetLang), targetLang, 'label_read');

  if (isUnusableVisualScan(scan)) {
    const rescueResult = await callGemini({
      contents: [
        {
          parts: [
            { text: makeVisualRescuePrompt(targetLang, image.payload.triggers) },
            {
              inlineData: {
                mimeType: image.payload.mimeType,
                data: image.payload.data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.35,
        maxOutputTokens: 520,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    if (!('error' in rescueResult)) {
      const rescueParsed = parseModelJson(rescueResult.text);
      const rescueScan = normalizeScanPayload(rescueParsed, targetLang);
      scan = isUnusableVisualScan(rescueScan)
        ? visualEstimateFallback(targetLang)
        : withScanConfidence(rescueScan, targetLang, 'visual_estimate');
    } else {
      scan = visualEstimateFallback(targetLang);
    }
  }

  const enrichedScan = await enrichWithProductDatabase(scan, targetLang);

  runAfterResponse(cacheScan(cacheKey, targetLang, enrichedScan));

  return jsonResponse(req, enrichedScan);
}

function parseModelJson(text: string): unknown {
  const withoutFence = text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  const firstBrace = withoutFence.indexOf('{');
  const lastBrace = withoutFence.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  try {
    return JSON.parse(withoutFence.slice(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
}

function normalizeVisualIdentity(value: unknown): VisualIdentityPayload | null {
  if (!isRecord(value)) {
    return null;
  }

  const productName = asBoundedString(value.productName, '', 120);
  const category = asBoundedString(value.category, '', 90);
  const isFood = value.isFood === true || `${value.isFood}`.toLowerCase() === 'true';

  if (!isFood || (!productName && !category)) {
    return null;
  }

  return {
    productName: productName || category,
    brand: asBoundedString(value.brand, 'Generic', 80),
    category: category || 'Food',
    confidenceScore: Math.max(0, Math.min(100, Math.round(Number(value.confidenceScore) || 60))),
    isFood,
    visibleText: asBoundedString(value.visibleText, '', 180),
  };
}

function asRating(value: unknown, fallback: Rating): Rating {
  return value === 'Safe' || value === 'Caution' || value === 'Avoid' ? value : fallback;
}

function asBoundedString(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : fallback;
}

function asScore(value: unknown) {
  const numberValue = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numberValue)) {
    return 50;
  }

  return Math.max(0, Math.min(100, Math.round(numberValue)));
}

function asNutritionNumber(value: unknown, fallback = 0) {
  const numberValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.max(0, Math.round(numberValue));
}

function normalizeNutrition(value: unknown): NutritionFacts | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    calories: asNutritionNumber(value.calories),
    proteinG: asNutritionNumber(value.proteinG),
    carbsG: asNutritionNumber(value.carbsG),
    fatG: asNutritionNumber(value.fatG),
    fiberG: asNutritionNumber(value.fiberG),
    sugarG: asNutritionNumber(value.sugarG),
    sodiumMg: asNutritionNumber(value.sodiumMg),
  };
}

function normalizeChemical(value: unknown): ChemicalReport | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    chemicalName: asBoundedString(value.chemicalName, 'Unspecified ingredient', 90),
    severity: asRating(value.severity, 'Caution'),
    reason: asBoundedString(value.reason, 'Needs a clearer label photo for a reliable review.', 180),
  };
}

function makeScanBasis(source: ScanConfidenceSource, targetLang: string) {
  const russian = targetLang === 'Russian';
  const basis: Record<ScanConfidenceSource, { portionBasis: string; decisionBasis: string; ruPortionBasis: string; ruDecisionBasis: string }> = {
    label_read: {
      portionBasis: 'One visible package or normal serving',
      decisionBasis: 'Visible label, packaging, and product category',
      ruPortionBasis: 'Одна видимая упаковка или обычная порция',
      ruDecisionBasis: 'Видимый состав, упаковка и категория продукта',
    },
    database_match: {
      portionBasis: 'One database serving when available',
      decisionBasis: 'Product database nutrition plus DigestSnap risk rules',
      ruPortionBasis: 'Одна порция из базы, если доступна',
      ruDecisionBasis: 'Пищевая база продукта и правила DigestSnap',
    },
    visual_estimate: {
      portionBasis: 'One normal visual serving',
      decisionBasis: 'Visual food recognition and category estimate',
      ruPortionBasis: 'Одна обычная порция по фото',
      ruDecisionBasis: 'Визуальное распознавание и оценка категории',
    },
    manual_text: {
      portionBasis: 'One normal serving or package',
      decisionBasis: 'Typed food or label text',
      ruPortionBasis: 'Одна обычная порция или упаковка',
      ruDecisionBasis: 'Введенное название или текст состава',
    },
    fallback: {
      portionBasis: 'Not counted until confirmed',
      decisionBasis: 'Scan was not clear enough to trust',
      ruPortionBasis: 'Не учитывается без подтверждения',
      ruDecisionBasis: 'Скан недостаточно четкий для доверия',
    },
    user_corrected: {
      portionBasis: 'User confirmed serving',
      decisionBasis: 'User-edited scan result',
      ruPortionBasis: 'Порция подтверждена пользователем',
      ruDecisionBasis: 'Результат исправлен пользователем',
    },
  };
  const selected = basis[source];

  return {
    portionBasis: russian ? selected.ruPortionBasis : selected.portionBasis,
    decisionBasis: russian ? selected.ruDecisionBasis : selected.decisionBasis,
  };
}

function normalizeScanBasis(value: unknown, targetLang: string, source: ScanConfidenceSource) {
  const fallback = makeScanBasis(source, targetLang);
  if (!isRecord(value)) {
    return fallback;
  }

  return {
    portionBasis: asBoundedString(value.portionBasis, fallback.portionBasis, 110),
    decisionBasis: asBoundedString(value.decisionBasis, fallback.decisionBasis, 140),
  };
}

function asConfidenceLevel(value: unknown, fallback: ScanConfidenceLevel): ScanConfidenceLevel {
  return value === 'high' || value === 'medium' || value === 'low' ? value : fallback;
}

function asConfidenceSource(value: unknown, fallback: ScanConfidenceSource): ScanConfidenceSource {
  return value === 'label_read' ||
    value === 'visual_estimate' ||
    value === 'database_match' ||
    value === 'manual_text' ||
    value === 'fallback' ||
    value === 'user_corrected'
    ? value
    : fallback;
}

function confidenceLevelFromScore(score: number): ScanConfidenceLevel {
  if (score >= 80) return 'high';
  if (score >= 55) return 'medium';
  return 'low';
}

function makeScanConfidence(source: ScanConfidenceSource, targetLang: string, scoreOverride?: number): ScanConfidence {
  const scoreBySource: Record<ScanConfidenceSource, number> = {
    label_read: 86,
    database_match: 92,
    visual_estimate: 64,
    manual_text: 68,
    fallback: 34,
    user_corrected: 100,
  };
  const score = Math.max(0, Math.min(100, Math.round(scoreOverride ?? scoreBySource[source])));
  const level = confidenceLevelFromScore(score);
  const russian = targetLang === 'Russian';
  const copy: Record<ScanConfidenceSource, { label: string; detail: string; ruLabel: string; ruDetail: string }> = {
    label_read: {
      label: 'Label read',
      detail: 'Visible label or packaging text informed this result',
      ruLabel: 'Состав прочитан',
      ruDetail: 'Результат основан на видимом тексте или упаковке',
    },
    database_match: {
      label: 'Database match',
      detail: 'Nutrition was matched against a product database',
      ruLabel: 'Найдено в базе',
      ruDetail: 'Пищевая ценность сверена с продуктовой базой',
    },
    visual_estimate: {
      label: 'Visual estimate',
      detail: 'AI recognized the food visually; portion and label are estimated',
      ruLabel: 'Визуальная оценка',
      ruDetail: 'AI распознал еду по фото; порция и состав примерные',
    },
    manual_text: {
      label: 'Text check',
      detail: 'Result is based on typed food or label text',
      ruLabel: 'Проверка текста',
      ruDetail: 'Результат основан на введенном названии или составе',
    },
    fallback: {
      label: 'Needs confirmation',
      detail: 'Saved, but this result should not be trusted yet',
      ruLabel: 'Нужна проверка',
      ruDetail: 'Фото сохранено, но результату нельзя доверять полностью',
    },
    user_corrected: {
      label: 'User corrected',
      detail: 'You corrected this scan manually',
      ruLabel: 'Исправлено вручную',
      ruDetail: 'Вы вручную исправили этот результат',
    },
  };
  const selected = copy[source];

  return {
    level,
    source,
    score,
    label: russian ? selected.ruLabel : selected.label,
    detail: russian ? selected.ruDetail : selected.detail,
  };
}

function normalizeConfidence(value: unknown, targetLang: string, fallback: ScanConfidence): ScanConfidence {
  if (!isRecord(value)) {
    return fallback;
  }

  const source = asConfidenceSource(value.source, fallback.source);
  const score = Math.max(0, Math.min(100, Math.round(Number(value.score) || fallback.score)));
  const base = makeScanConfidence(source, targetLang, score);

  return {
    level: asConfidenceLevel(value.level, base.level),
    source,
    score,
    label: asBoundedString(value.label, base.label, 60),
    detail: asBoundedString(value.detail, base.detail, 140),
  };
}

function withScanConfidence(scan: ScanPayload, targetLang: string, source?: ScanConfidenceSource, scoreOverride?: number): ScanPayload {
  const fallbackSource = source ?? scan.result.confidence?.source ?? (isUnusableVisualScan(scan) ? 'fallback' : 'label_read');
  const fallback = makeScanConfidence(fallbackSource, targetLang, scoreOverride ?? (source ? undefined : scan.result.confidence?.score));
  const confidence = normalizeConfidence(source ? null : scan.result.confidence, targetLang, fallback);

  return {
    result: {
      ...scan.result,
      confidence,
      basis: normalizeScanBasis(scan.result.basis, targetLang, confidence.source),
    },
  };
}

function normalizeScanPayload(value: unknown, targetLang: string, fallback: ScanPayload = fallbackScanPayload(targetLang)): ScanPayload {
  if (!isRecord(value) || !isRecord(value.result)) {
    return withScanConfidence(fallback, targetLang);
  }

  const flaggedChemicals = Array.isArray(value.result.flaggedChemicals)
    ? value.result.flaggedChemicals.map(normalizeChemical).filter((item): item is ChemicalReport => item !== null).slice(0, 12)
    : [];
  const rawConfidenceSource = isRecord(value.result.confidence) ? value.result.confidence.source : undefined;

  return withScanConfidence(enforceFoodRiskRules({
    result: {
      productName: asBoundedString(value.result.productName, targetLang === 'Russian' ? 'Визуальная оценка продукта' : 'Visual product estimate', 120),
      overallRating: asRating(value.result.overallRating, flaggedChemicals.length > 0 ? 'Caution' : 'Safe'),
      score: asScore(value.result.score),
      nutrition: normalizeNutrition(value.result.nutrition),
      confidence: normalizeConfidence(value.result.confidence, targetLang, makeScanConfidence('label_read', targetLang)),
      basis: normalizeScanBasis(value.result.basis, targetLang, asConfidenceSource(rawConfidenceSource, 'label_read')),
      flaggedChemicals,
    },
  }, targetLang), targetLang);
}

function getScanText(scan: ScanPayload) {
  return [
    scan.result.productName,
    scan.result.overallRating,
    ...scan.result.flaggedChemicals.flatMap((item) => [item.chemicalName, item.reason, item.severity]),
  ]
    .join(' ')
    .toLowerCase();
}

function hasAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function matchesEverydayRule(text: string, rule: EverydayFoodRule) {
  if (!hasAny(text, rule.patterns)) return false;
  if (rule.excludePatterns && hasAny(text, rule.excludePatterns)) return false;
  return true;
}

function makeConcern(chemicalName: string, reason: string, severity: Rating): ChemicalReport {
  return {
    chemicalName,
    reason,
    severity,
  };
}

function dedupeConcerns(items: ChemicalReport[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.chemicalName.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function enforceFoodRiskRules(scan: ScanPayload, targetLang: string): ScanPayload {
  const text = getScanText(scan);
  const concerns = [...scan.result.flaggedChemicals];
  let rating = scan.result.overallRating;
  let score = scan.result.score;
  const matchedStrictRules = STRICT_FOOD_RISK_RULES.filter((rule) => hasAny(text, rule.patterns));
  const matchedEverydayRule = EVERYDAY_FOOD_RULES.find((rule) => matchesEverydayRule(text, rule));
  const hasAvoidRule = matchedStrictRules.some((rule) => rule.rating === 'Avoid');

  for (const rule of matchedStrictRules) {
    if (rule.rating === 'Avoid') {
      rating = 'Avoid';
    } else if (rating === 'Safe') {
      rating = 'Caution';
    }

    score = Math.min(score, rule.maxScore);
    concerns.unshift(
      makeConcern(
        targetLang === 'Russian' ? rule.concern.ru : rule.concern.en,
        targetLang === 'Russian' ? rule.reason.ru : rule.reason.en,
        rule.rating,
      ),
    );
  }

  if (matchedEverydayRule && !hasAvoidRule) {
    if (matchedStrictRules.length === 0) {
      rating = matchedEverydayRule.rating;
      score = matchedEverydayRule.score;
    } else if (matchedEverydayRule.rating === 'Caution') {
      if (rating === 'Safe') rating = 'Caution';
      score = Math.min(score, matchedEverydayRule.score);
    }

    concerns.unshift(
      makeConcern(
        targetLang === 'Russian' ? matchedEverydayRule.concern.ru : matchedEverydayRule.concern.en,
        targetLang === 'Russian' ? matchedEverydayRule.reason.ru : matchedEverydayRule.reason.en,
        matchedEverydayRule.rating,
      ),
    );
  }

  const isSweetDrink = hasAny(text, [
    /\bfuse\s*tea\b/i,
    /\biced?\s*tea\b/i,
    /\bsweet(?:ened)?\s*tea\b/i,
    /\bsoda\b/i,
    /\bcola\b/i,
    /\bfanta\b/i,
    /\bsprite\b/i,
    /\bpepsi\b/i,
    /\bcoca[-\s]?cola\b/i,
    /\benergy\s*drink\b/i,
    /\bsoft\s*drink\b/i,
    /газиров/i,
    /сладк\w*\s+напит/i,
    /холодн\w*\s+чай/i,
    /сладк\w*\s+чай/i,
    /энергет/i,
  ]);
  const isPlainWholeFruit = hasAny(text, [
    /\bbanana\b/i,
    /\bapple\b/i,
    /\borange\b/i,
    /\bberries?\b/i,
    /\bstrawberries?\b/i,
    /\bgrapes?\b/i,
    /\bkiwi\b/i,
    /банан/i,
    /яблок/i,
    /апельсин/i,
    /ягод/i,
    /клубник/i,
    /виноград/i,
    /киви/i,
  ]) && !hasAny(text, [/\bjuice\b/i, /\bsmoothie\b/i, /\bsyrup\b/i, /\bcandy\b/i, /\bcake\b/i, /\bpie\b/i, /\bsweetened\b/i, /сок/i, /смузи/i, /сироп/i, /конфет/i, /торт/i]);
  const hasSugarSignal = hasAny(text, [
    /\bsugar\b/i,
    /\bglucose\b/i,
    /\bfructose\b/i,
    /\bsyrup\b/i,
    /\bsucrose\b/i,
    /\b\d{1,2}\s*g\s*(?:sugar|sugars)\b/i,
    /сахар/i,
    /сироп/i,
    /глюкоз/i,
    /фруктоз/i,
  ]);
  const hasCaffeineSignal = hasAny(text, [/\bcaffeine\b/i, /\btea\s*extract\b/i, /\bblack\s*tea\b/i, /\bgreen\s*tea\b/i, /кофеин/i, /чай/i]);
  const hasAcidSignal = hasAny(text, [/\bcitric\s*acid\b/i, /\bphosphoric\s*acid\b/i, /\bacidity\s*regulator\b/i, /\bacid\b/i, /кислот/i, /регулятор\s+кислотности/i]);

  if (isSweetDrink) {
    rating = 'Avoid';
    score = Math.min(score, hasSugarSignal ? 38 : 50);
    concerns.unshift(
      makeConcern(
        targetLang === 'Russian' ? 'Сладкий напиток' : 'Sweetened drink',
        targetLang === 'Russian' ? 'Частый триггер сахара и кислотности.' : 'Common sugar and acidity trigger.',
        'Avoid',
      ),
    );
  }

  if (hasSugarSignal && !isPlainWholeFruit) {
    score = Math.min(score, 55);
    if (rating === 'Safe') rating = 'Caution';
    concerns.unshift(
      makeConcern(
        targetLang === 'Russian' ? 'Сахар' : 'Sugar',
        targetLang === 'Russian' ? 'Может усиливать вздутие у некоторых.' : 'Can worsen bloating for some.',
        isSweetDrink ? 'Avoid' : 'Caution',
      ),
    );
  }

  if (hasCaffeineSignal) {
    concerns.push(
      makeConcern(
        targetLang === 'Russian' ? 'Кофеин или чайный экстракт' : 'Caffeine or tea extract',
        targetLang === 'Russian' ? 'Может раздражать чувствительный желудок.' : 'May irritate sensitive stomachs.',
        'Caution',
      ),
    );
  }

  if (hasAcidSignal) {
    concerns.push(
      makeConcern(
        targetLang === 'Russian' ? 'Кислотность' : 'Acidity',
        targetLang === 'Russian' ? 'Кислоты могут усиливать дискомфорт.' : 'Acids may worsen discomfort.',
        'Caution',
      ),
    );
  }

  if (score >= 75 && rating === 'Safe' && concerns.length > 0) {
    const concernText = concerns.map((item) => `${item.chemicalName} ${item.reason}`).join(' ').toLowerCase();
    if (!isPlainWholeFruit && hasAny(concernText, [/\bsugar\b/i, /\bcaffeine\b/i, /\bacid\b/i, /\bsweet/i, /\bpreservative/i])) {
      rating = 'Caution';
      score = Math.min(score, 60);
    }
  }

  return {
    result: {
      ...scan.result,
      overallRating: rating,
      score,
      flaggedChemicals: dedupeConcerns(concerns).slice(0, 4),
    },
  };
}

function fallbackScanPayload(targetLang: string): ScanPayload {
  if (targetLang === 'Russian') {
    return {
      result: {
        productName: 'Визуальная оценка продукта',
        overallRating: 'Caution',
        score: 50,
        confidence: makeScanConfidence('fallback', targetLang),
        flaggedChemicals: [
          {
            chemicalName: 'Оценка по фото',
            severity: 'Caution',
            reason: 'Состав не подтвержден, оценка осторожная.',
          },
        ],
      },
    };
  }

  return {
    result: {
      productName: 'Visual product estimate',
      overallRating: 'Caution',
      score: 50,
      confidence: makeScanConfidence('fallback', targetLang),
      flaggedChemicals: [
        {
          chemicalName: 'Image-based estimate',
          severity: 'Caution',
          reason: 'Label not verified, rating stays cautious.',
        },
      ],
    },
  };
}

function fallbackFoodTextPayload(payload: FoodTextPayload, targetLang: string): ScanPayload {
  const productName = localizeProductDisplayName(payload.productKey || payload.text, targetLang);
  const normalizedInput = `${payload.text} ${payload.productKey}`.toLowerCase();
  const triggerSynonyms: Record<string, string[]> = {
    'fried food': ['fried', 'fries', 'burger', 'nugget', 'crispy', 'deep fried'],
    soda: ['soda', 'cola', 'sprite', 'fanta', 'carbonated', 'soft drink'],
    dairy: ['milk', 'cream', 'cheese', 'yogurt', 'butter', 'dairy'],
    bread: ['bread', 'bun', 'toast', 'flour', 'wheat', 'wrap'],
    gluten: ['bread', 'bun', 'toast', 'flour', 'wheat', 'pasta'],
    caffeine: ['coffee', 'espresso', 'energy drink', 'caffeine'],
    'spicy food': ['spicy', 'chili', 'hot sauce', 'jalapeno'],
    onion: ['onion'],
    garlic: ['garlic'],
  };
  const matchedTriggers = payload.triggers.filter((trigger) => {
    const normalizedTrigger = trigger.toLowerCase();
    const synonyms = triggerSynonyms[normalizedTrigger] ?? [normalizedTrigger];
    return synonyms.some((synonym) => normalizedInput.includes(synonym));
  });
  const firstRawTrigger = matchedTriggers[0] ?? payload.triggers[0] ?? '';
  const firstTrigger = localizeTriggerName(firstRawTrigger, targetLang) || (targetLang === 'Russian' ? 'Возможный триггер' : 'Possible trigger');
  const secondTrigger =
    targetLang === 'Russian'
      ? payload.inputType === 'dish'
        ? 'Типичный способ приготовления'
        : 'Проверка состава'
      : payload.inputType === 'dish'
        ? 'Common preparation'
        : 'Label review';
  const hasStrongMatch = matchedTriggers.length > 0;
  const fallbackStrictRules = STRICT_FOOD_RISK_RULES.filter((rule) => hasAny(normalizedInput, rule.patterns));
  const strictAvoid = fallbackStrictRules.some((rule) => rule.rating === 'Avoid');
  const strictMaxScore = fallbackStrictRules.length > 0 ? Math.min(...fallbackStrictRules.map((rule) => rule.maxScore)) : 55;
  const likelyFriedOrSoda = /\b(fried|fries|burger|nugget|crispy|soda|cola|fanta|sprite|soft drink|iced tea|ice tea|sweetened tea|fuse tea|energy drink|carbonated)\b/i.test(normalizedInput);
  const likelySugarDrink = /\b(sugar|glucose|fructose|syrup|sweetened|iced tea|ice tea|fuse tea|soda|cola|soft drink|energy drink)\b/i.test(normalizedInput);
  const rating: Rating = strictAvoid || (hasStrongMatch && likelyFriedOrSoda) ? 'Avoid' : hasStrongMatch || fallbackStrictRules.length > 0 ? 'Caution' : 'Caution';
  const score = Math.min(rating === 'Avoid' ? 38 : likelySugarDrink ? 45 : hasStrongMatch ? 58 : 55, strictMaxScore);
  const firstReason =
    targetLang === 'Russian'
      ? hasStrongMatch
        ? 'Совпадает с вашим сохраненным триггером.'
        : 'Проверьте состав или уточните у ресторана.'
      : hasStrongMatch
        ? 'Matches a saved possible trigger.'
        : 'Check ingredients or ask the restaurant.';
  const secondReason =
    targetLang === 'Russian'
      ? rating === 'Avoid'
        ? 'Похожий профиль часто вызывает реакцию.'
        : 'Быстрая оценка без гарантии безопасности.'
      : rating === 'Avoid'
        ? 'Similar profile often causes reactions.'
        : 'Quick estimate, not a safety guarantee.';

  if (targetLang === 'Russian') {
    return withScanConfidence(enforceFoodRiskRules({
      result: {
        productName,
        overallRating: rating,
        score,
        flaggedChemicals: [
          {
            chemicalName: firstTrigger,
            severity: rating,
            reason: firstReason,
          },
          {
            chemicalName: secondTrigger,
            severity: rating === 'Avoid' ? 'Caution' : rating,
            reason: secondReason,
          },
        ],
      },
    }, targetLang), targetLang, 'manual_text');
  }

  return withScanConfidence(enforceFoodRiskRules({
    result: {
      productName,
      overallRating: rating,
      score,
      flaggedChemicals: [
        {
          chemicalName: firstTrigger,
          severity: rating,
          reason: firstReason,
        },
        {
          chemicalName: secondTrigger,
          severity: rating === 'Avoid' ? 'Caution' : rating,
          reason: secondReason,
        },
      ],
    },
  }, targetLang), targetLang, 'manual_text');
}

function localizeTriggerName(value: string, targetLang: string) {
  if (targetLang !== 'Russian') {
    return value;
  }

  const normalized = value.trim().toLowerCase();
  const translations: Record<string, string> = {
    dairy: 'Молочные продукты',
    bread: 'Хлеб',
    gluten: 'Глютен',
    soda: 'Газировка',
    caffeine: 'Кофеин',
    'fried food': 'Жареная еда',
    'late meals': 'Поздняя еда',
    'spicy food': 'Острая еда',
    onion: 'Лук',
    garlic: 'Чеснок',
  };

  return translations[normalized] ?? value;
}

function localizeProductDisplayName(value: string, targetLang: string) {
  if (targetLang !== 'Russian') {
    return value;
  }

  const normalized = value.toLowerCase();
  if (/\bfuse\s*tea\b/i.test(value) || /\biced?\s*tea\b/i.test(value) || /\bice\s*tea\b/i.test(value)) {
    return /\bfuse\s*tea\b/i.test(value) ? 'Fuse Tea, сладкий холодный чай' : 'Сладкий холодный чай';
  }
  if (/\bcoca[-\s]?cola\b/i.test(value)) {
    return 'Coca-Cola, сладкая газировка';
  }
  if (/\bpepsi\b|\bfanta\b|\bsprite\b|\bsoda\b|\bsoft\s*drink\b|\bcola\b/i.test(value)) {
    return 'Сладкая газировка';
  }
  if (/\benergy\s*drink\b|\bred\s*bull\b|\bmonster\b|\btaurine\b/i.test(value)) {
    return 'Энергетический напиток';
  }
  if (/\bfried\s*chicken\b|\bnuggets?\b|\bfries\b|\bfrench\s*fries\b|\bdeep[-\s]?fried\b/i.test(value)) {
    return 'Жареная еда';
  }
  if (/\bburger\b|\bcheeseburger\b|\bfast\s*food\b/i.test(value)) {
    return 'Фастфуд';
  }
  if (/\bchips?\b|\bcrisps?\b|\bdoritos\b|\bcheetos\b|\bpringles\b/i.test(value)) {
    return 'Жареный снек';
  }
  if (/\bwater\b|\bmineral\b|\bspring\s*water\b/i.test(value)) {
    return 'Бутилированная вода';
  }
  if (/\bavocados?\b/i.test(value)) return 'Авокадо';
  if (/\beggs?\b|\bomelette\b/i.test(value)) return 'Яйца';
  if (/\bchicken\b|\bturkey\b/i.test(value)) return 'Курица';
  if (/\bbeef\b|\bsteak\b|\bmeat\b/i.test(value)) return 'Мясо';
  if (/\bfish\b|\bsalmon\b|\btuna\b|\bseafood\b/i.test(value)) return 'Рыба';
  if (/\brice\b/i.test(value)) return 'Рис';
  if (/\bbuckwheat\b/i.test(value)) return 'Гречка';
  if (/\boats?\b|\boatmeal\b/i.test(value)) return 'Овсянка';
  if (/\bpasta\b|\bmacaroni\b|\bspaghetti\b|\bnoodles?\b/i.test(value)) return 'Макароны';
  if (/\bbread\b|\btoast\b|\bwrap\b|\bbun\b/i.test(value)) return 'Хлеб';
  if (/\bpotatoes?\b/i.test(value)) return 'Картофель';
  if (/\bbeans?\b|\blentils?\b|\bchickpeas?\b/i.test(value)) return 'Бобовые';
  if (/\bmilk\b|\byog(?:h)?urt\b|\bcheese\b|\bkefir\b/i.test(value)) return 'Молочные продукты';
  if (/\bbanana\b|\bapple\b|\borange\b|\bberries?\b|\bgrapes?\b|\bkiwi\b/i.test(value)) return 'Фрукты';
  if (/\bvegetables?\b|\bsalad\b|\bcucumber\b|\btomato\b|\bcarrot\b|\bbroccoli\b|\bspinach\b/i.test(value)) return 'Овощи';
  if (/\bcoffee\b|\bespresso\b|\blatte\b/i.test(value)) return 'Кофе';
  if (normalized.trim()) {
    return value;
  }

  return 'Продукт по фото';
}

function getRestUrl(path: string) {
  if (!SUPABASE_URL) {
    return '';
  }

  return `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${path}`;
}

function getServiceHeaders(extraHeaders: Record<string, string> = {}) {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
}

async function readCachedScan(imageHash: string, targetLang: string): Promise<ScanPayload | null> {
  const headers = getServiceHeaders();
  const url = getRestUrl(
    `cached_labels?image_hash=eq.${encodeURIComponent(imageHash)}&target_language=eq.${encodeURIComponent(targetLang)}&select=scan_result&limit=1`,
  );

  if (!headers || !url) {
    return null;
  }

  try {
    const response = await fetchWithTimeout(url, { headers }, CACHE_READ_TIMEOUT_MS);

    if (!response.ok) {
      return null;
    }

    const rows: unknown = await response.json();

    if (!Array.isArray(rows) || !isRecord(rows[0])) {
      return null;
    }

    return normalizeScanPayload(rows[0].scan_result, targetLang);
  } catch {
    return null;
  }
}

function isUnreadableProductName(productName: string) {
  const normalizedName = productName.toLowerCase();
  return normalizedName.includes('unreadable') || normalizedName.includes('нечита');
}

function isUnusableVisualScan(scan: ScanPayload) {
  const productName = scan.result.productName.toLowerCase();
  const hardFailureText = scan.result.flaggedChemicals
    .flatMap((item) => [item.chemicalName, item.reason])
    .join(' ')
    .toLowerCase();

  return hasAny(productName, [
    /\bunreadable\b/i,
    /\bvisual\s+product\s+estimate\b/i,
    /\bimage\s*unclear\b/i,
    /\bcould\s*not\s*verify\b/i,
    /\bvisual\s*estimate\s*unavailable\b/i,
    /\bno\s*recognizable\b/i,
    /\bnot\s*checked\b/i,
    /визуальн\w*\s+оценк/i,
    /нечита/i,
  ]) || hasAny(hardFailureText, [/\bno\s*recognizable\b/i, /\bimage\s*unclear\b/i, /\bnot\s*checked\b/i, /нечита/i]);
}

function visualEstimateFallback(targetLang: string): ScanPayload {
  if (targetLang === 'Russian') {
    return {
      result: {
        productName: 'Визуальная оценка продукта',
        overallRating: 'Caution',
        score: 50,
        confidence: makeScanConfidence('fallback', targetLang),
        flaggedChemicals: [
          {
            chemicalName: 'Оценка по фото',
            severity: 'Caution',
            reason: 'Категория видна, состав не подтвержден.',
          },
          {
            chemicalName: 'Состав не подтвержден',
            severity: 'Caution',
            reason: 'Используйте как осторожную оценку.',
          },
        ],
      },
    };
  }

  return {
    result: {
      productName: 'Visual product estimate',
      overallRating: 'Caution',
      score: 50,
      confidence: makeScanConfidence('fallback', targetLang),
      flaggedChemicals: [
        {
          chemicalName: 'Visual estimate',
          severity: 'Caution',
          reason: 'Category visible, label not verified.',
        },
        {
          chemicalName: 'Label not confirmed',
          severity: 'Caution',
          reason: 'Use as a cautious first read.',
        },
      ],
    },
  };
}

function asOptionalNutritionNumber(...values: unknown[]) {
  for (const value of values) {
    const numberValue = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(numberValue) && numberValue >= 0) {
      return Math.round(numberValue);
    }
  }

  return 0;
}

function nutritionFromOpenFoodFacts(value: unknown): NutritionFacts | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const servingQuantity = Number(value.serving_quantity);
  const per100Multiplier = Number.isFinite(servingQuantity) && servingQuantity > 0 && servingQuantity <= 1000 ? servingQuantity / 100 : 1;
  const nutriments = isRecord(value.nutriments) ? value.nutriments : {};
  const perServing = (key: string) => nutriments[`${key}_serving`];
  const per100 = (key: string) => {
    const numberValue = Number(nutriments[`${key}_100g`]);
    return Number.isFinite(numberValue) ? numberValue * per100Multiplier : undefined;
  };
  const sodiumG = Number(perServing('sodium') ?? per100('sodium'));
  const sodiumMg = Number.isFinite(sodiumG) ? Math.round(Math.max(0, sodiumG * 1000)) : asOptionalNutritionNumber(perServing('sodium_mg'), per100('sodium_mg'));
  const nutrition: NutritionFacts = {
    calories: asOptionalNutritionNumber(perServing('energy-kcal'), per100('energy-kcal')),
    proteinG: asOptionalNutritionNumber(perServing('proteins'), per100('proteins')),
    carbsG: asOptionalNutritionNumber(perServing('carbohydrates'), per100('carbohydrates')),
    fatG: asOptionalNutritionNumber(perServing('fat'), per100('fat')),
    fiberG: asOptionalNutritionNumber(perServing('fiber'), per100('fiber')),
    sugarG: asOptionalNutritionNumber(perServing('sugars'), per100('sugars')),
    sodiumMg,
  };

  if (nutrition.calories <= 0 && nutrition.proteinG <= 0 && nutrition.carbsG <= 0 && nutrition.fatG <= 0) {
    return undefined;
  }

  return nutrition;
}

function cleanDatabaseQueryFromText(value: string) {
  const query = value
    .replace(/\b(visual|estimate|product|food|scan|unreadable|image|check|error)\b/gi, ' ')
    .replace(/\b(likely|possible|generic|category)\b/gi, ' ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (query.length < 3 || isUnreadableProductName(query) || isGenericDatabaseQuery(query)) {
    return '';
  }

  return query.slice(0, 120);
}

function cleanDatabaseQuery(scan: ScanPayload) {
  return cleanDatabaseQueryFromText(scan.result.productName);
}

function normalizeLookupText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function queryTokens(value: string) {
  return normalizeLookupText(value)
    .split(' ')
    .filter((token) => token.length >= 3 && !['food', 'product', 'likely', 'generic'].includes(token));
}

function isGenericDatabaseQuery(value: string) {
  const normalized = normalizeLookupText(value);
  const tokens = queryTokens(value);
  return (
    tokens.length <= 1 &&
    hasAny(normalized, [
      /\bapple\b/i,
      /\bbanana\b/i,
      /\borange\b/i,
      /\bavocado\b/i,
      /\begg\b/i,
      /\beggs\b/i,
      /\bcucumber\b/i,
      /\btomato\b/i,
      /\brice\b/i,
      /\boats?\b/i,
      /\bchicken\b/i,
      /\bbeef\b/i,
      /\bfish\b/i,
      /\bwater\b/i,
      /яблок/i,
      /банан/i,
      /апельсин/i,
      /авокад/i,
      /яйц/i,
      /огур/i,
      /томат/i,
      /рис/i,
      /куриц/i,
      /говядин/i,
      /рыб/i,
      /вода/i,
    ])
  );
}

function databaseMatchScore(query: string, productName: string, brand: string) {
  const queryText = normalizeLookupText(query);
  const productText = normalizeLookupText(`${brand} ${productName}`);
  const qTokens = queryTokens(query);
  const pTokens = new Set(queryTokens(`${brand} ${productName}`));

  if (!queryText || !productText || qTokens.length === 0) {
    return 0;
  }

  if (productText.includes(queryText) || queryText.includes(productText.slice(0, Math.min(18, productText.length)))) {
    return 92;
  }

  const overlap = qTokens.filter((token) => pTokens.has(token)).length;
  const overlapRatio = overlap / qTokens.length;

  if (overlapRatio >= 0.75) return 88;
  if (overlapRatio >= 0.5) return 82;
  if (overlapRatio >= 0.34 && qTokens.length >= 2) return 76;

  return 0;
}

async function lookupOpenFoodFacts(query: string): Promise<ProductDatabaseMatch | null> {
  if (!query) return null;

  const params = new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '1',
    fields: 'product_name,brands,categories,serving_quantity,nutriments,nutriscore_grade',
  });
  const url = `https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`;

  try {
    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          accept: 'application/json',
          'user-agent': 'DigestSnap/1.0 demo nutrition lookup',
        },
      },
      OPEN_FOOD_FACTS_TIMEOUT_MS,
    );

    if (!response.ok) {
      return null;
    }

    const payload: unknown = await response.json();
    if (!isRecord(payload) || !Array.isArray(payload.products) || !isRecord(payload.products[0])) {
      return null;
    }

    const product = payload.products[0];
    const productName = asBoundedString(product.product_name, '', 120);
    if (!productName) {
      return null;
    }
    const brand = asBoundedString(product.brands, '', 90).split(',')[0]?.trim() ?? '';
    const confidenceScore = databaseMatchScore(query, productName, brand);
    if (confidenceScore < 76) {
      return null;
    }

    return {
      productName,
      brand,
      category: asBoundedString(product.categories, '', 120).split(',')[0]?.trim() ?? '',
      confidenceScore,
      nutrition: nutritionFromOpenFoodFacts(product),
    };
  } catch {
    return null;
  }
}

function databaseLookupCandidates(scan: ScanPayload) {
  const candidates = [
    scan.result.productName,
    scan.result.productName.replace(/\b(likely|possible)\b/gi, ' '),
    scan.result.productName.replace(/[^\p{L}\p{N}\s]/gu, ' '),
  ]
    .map(cleanDatabaseQueryFromText)
    .filter(Boolean);

  return Array.from(new Set(candidates)).slice(0, 3);
}

async function lookupBestOpenFoodFactsMatch(scan: ScanPayload) {
  const candidates = databaseLookupCandidates(scan);

  for (const candidate of candidates) {
    const match = await lookupOpenFoodFacts(candidate);
    if (match) {
      return match;
    }
  }

  return null;
}

async function enrichWithProductDatabase(scan: ScanPayload, targetLang: string): Promise<ScanPayload> {
  if (isUnusableVisualScan(scan)) return scan;

  const match = await lookupBestOpenFoodFactsMatch(scan);
  if (!match) return scan;

  const productName = [match.brand, match.productName]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  const databaseScan: ScanPayload = {
    result: {
      ...scan.result,
      productName: productName || scan.result.productName,
      nutrition: match.nutrition ?? scan.result.nutrition,
    },
  };

  return withScanConfidence(enforceFoodRiskRules(databaseScan, targetLang), targetLang, 'database_match', match.confidenceScore);
}

async function identifyAndRateVisibleFood(image: ImagePayload, targetLang: string): Promise<ScanPayload | null> {
  const identityResult = await callGemini({
    contents: [
      {
        parts: [
          { text: makeVisualIdentityPrompt(targetLang) },
          {
            inlineData: {
              mimeType: image.mimeType,
              data: image.data,
            },
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.05,
      maxOutputTokens: 500,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  if ('error' in identityResult) {
    return null;
  }

  const identity = normalizeVisualIdentity(parseModelJson(identityResult.text));

  if (!identity) {
    return null;
  }

  return fallbackVisualIdentityPayload(identity, targetLang, image.triggers);
}

function fallbackVisualIdentityPayload(identity: VisualIdentityPayload, targetLang: string, triggers: string[] = []): ScanPayload {
  const identityText = `${identity.productName} ${identity.brand} ${identity.category} ${identity.visibleText}`.toLowerCase();
  const triggerText = triggers.join(' ').toLowerCase();
  const hasTriggerOverlap = triggers.some((trigger) => identityText.includes(trigger.toLowerCase()));
  let rating: Rating = 'Caution';
  let score = hasTriggerOverlap ? 48 : 58;

  if (hasAny(identityText, [/\bwater\b/i, /минерал/i, /вода/i, /borjomi/i, /spring\s+water/i])) {
    rating = 'Safe';
    score = 88;
  } else if (hasAny(identityText, [/\bbanana\b/i, /\bapple\b/i, /\borange\b/i, /\bberries?\b/i, /\bstrawberries?\b/i, /\bgrapes?\b/i, /\bkiwi\b/i, /банан/i, /яблок/i, /апельсин/i, /ягод/i, /клубник/i, /виноград/i, /киви/i])) {
    rating = hasTriggerOverlap ? 'Caution' : 'Safe';
    score = hasTriggerOverlap ? 62 : 90;
  } else if (hasAny(identityText, [/\bavocado\b/i, /\begg\b/i, /\beggs\b/i, /\bcucumber\b/i, /\btomato\b/i, /\brice\b/i, /\boats?\b/i, /авокад/i, /яйц/i, /огур/i, /томат/i, /рис/i, /овсян/i])) {
    rating = hasTriggerOverlap ? 'Caution' : 'Safe';
    score = hasTriggerOverlap ? 62 : 82;
  } else if (hasAny(identityText, [/\bchocolate\b/i, /\bcandy\b/i, /\bsweet\b/i, /\bsnack\s*bar\b/i, /\bkinder\b/i, /\bcookie\b/i, /\bcake\b/i, /шоколад/i, /конфет/i, /слад/i, /батончик/i, /ломтик/i, /печень/i])) {
    rating = 'Avoid';
    score = 36;
  } else if (hasAny(identityText, [/\bsoda\b/i, /\bcola\b/i, /\bfanta\b/i, /\bsprite\b/i, /\bfuse\s*tea\b/i, /\biced?\s*tea\b/i, /\benergy\s*drink\b/i, /газиров/i, /кола/i, /чай/i, /энергет/i])) {
    rating = 'Avoid';
    score = 34;
  } else if (hasAny(identityText, [/\bchips?\b/i, /\bcrisps?\b/i, /\bfried\b/i, /\bfries\b/i, /\bburger\b/i, /\bnuggets?\b/i, /чипс/i, /жарен/i, /бургер/i])) {
    rating = 'Avoid';
    score = 40;
  } else if (hasAny(identityText, [/\bpasta\b/i, /\bmacaroni\b/i, /\bbread\b/i, /\bmilk\b/i, /\bdairy\b/i, /\byogurt\b/i, /\bcheese\b/i, /макарон/i, /паста/i, /хлеб/i, /молоч/i, /йогурт/i, /сыр/i])) {
    rating = hasTriggerOverlap || hasAny(triggerText, [/dairy/i, /bread/i, /gluten/i]) ? 'Caution' : 'Caution';
    score = hasTriggerOverlap ? 50 : 62;
  }

  const productName = [identity.brand && identity.brand !== 'Generic' ? identity.brand : '', identity.productName]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  const firstConcern =
    targetLang === 'Russian'
      ? rating === 'Safe'
        ? 'Простой продукт'
        : rating === 'Avoid'
          ? 'Сильный возможный триггер'
          : 'Возможный триггер'
      : rating === 'Safe'
        ? 'Simple food'
        : rating === 'Avoid'
          ? 'Strong possible trigger'
          : 'Possible trigger';
  const firstReason =
    targetLang === 'Russian'
      ? rating === 'Safe'
        ? 'Низкий сигнал риска по фото.'
        : rating === 'Avoid'
          ? 'Часто связан с дискомфортом.'
          : 'Стоит проверить по реакции.'
      : rating === 'Safe'
        ? 'Low risk signal from image.'
        : rating === 'Avoid'
          ? 'Often linked with discomfort.'
          : 'Worth checking against reactions.';

  return withScanConfidence(normalizeScanPayload(
    {
      result: {
        productName: productName || identity.category,
        overallRating: rating,
        score,
        flaggedChemicals: [
          {
            chemicalName: firstConcern,
            severity: rating,
            reason: firstReason,
          },
          {
            chemicalName: targetLang === 'Russian' ? 'Визуальное распознавание' : 'Visual recognition',
            severity: 'Caution',
            reason: targetLang === 'Russian' ? 'Название найдено по фото.' : 'Name detected from image.',
          },
        ],
      },
    },
    targetLang,
  ), targetLang, 'visual_estimate', identity.confidenceScore);
}

async function cacheScan(imageHash: string, targetLang: string, scan: ScanPayload) {
  const headers = getServiceHeaders({
    Prefer: 'resolution=merge-duplicates',
  });
  const url = getRestUrl('cached_labels?on_conflict=image_hash,target_language');

  if (!headers || !url || isUnreadableProductName(scan.result.productName) || isUnusableVisualScan(scan)) {
    return;
  }

  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          image_hash: imageHash,
          target_language: targetLang,
          product_name: scan.result.productName,
          scan_result: scan,
          updated_at: new Date().toISOString(),
        }),
      },
      CACHE_WRITE_TIMEOUT_MS,
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('DigestSnap cache write failed.', response.status, errorText.slice(0, 300));
    }
  } catch (error) {
    console.error('DigestSnap cache write failed.', error);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(JSON.stringify({ ok: true }), {
      headers: getCorsHeaders(req),
    });
  }

  if (!isOriginAllowed(req.headers.get('origin'))) {
    return jsonResponse(req, { error: 'Origin is not allowed.' }, 403);
  }

  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'Use POST.' }, 405);
  }

  if (!req.headers.get('content-type')?.includes('application/json')) {
    return jsonResponse(req, { error: 'Use application/json.' }, 415);
  }

  if (isRequestBodyTooLarge(req)) {
    return jsonResponse(req, { error: 'Upload is too large. Please use a smaller or compressed image.' }, 413);
  }

  if (!GEMINI_API_KEY) {
    return jsonResponse(req, { error: 'AI is not configured.' }, 503);
  }

  const body = await readJsonBody(req);

  if (!body) {
    return jsonResponse(req, { error: 'Invalid JSON body.' }, 400);
  }

  const isImageRequest = typeof body.imageBase64 === 'string' && body.imageBase64.trim().length > 0;
  const isFoodTextRequest =
    typeof body.labelText === 'string' && body.labelText.trim().length > 0
      ? true
      : typeof body.dishName === 'string' && body.dishName.trim().length > 0;
  const scope = isImageRequest ? 'image' : isFoodTextRequest ? 'food-text' : 'text';
  const maxRequests = isImageRequest ? IMAGE_RATE_LIMIT_MAX_REQUESTS : RATE_LIMIT_MAX_REQUESTS;

  if (isRateLimited(req, scope, maxRequests)) {
    return jsonResponse(req, { error: 'Too many requests. Try again soon.' }, 429);
  }

  if (isImageRequest) {
    return await handleImageRequest(req, body);
  }

  if (isFoodTextRequest) {
    return await handleFoodTextScanRequest(req, body);
  }

  return await handleTextRequest(req, body);
});
