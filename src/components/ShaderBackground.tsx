import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

type ShaderBackgroundProps = {
  targetRef: RefObject<HTMLElement | null>;
  className?: string;
};

type ShaderRuntime = {
  rafId: number | null;
  gl: WebGLRenderingContext | null;
  program: WebGLProgram | null;
  vertexShader: WebGLShader | null;
  fragmentShader: WebGLShader | null;
  buffer: WebGLBuffer | null;
  resolutionLocation: WebGLUniformLocation | null;
  mouseLocation: WebGLUniformLocation | null;
  timeLocation: WebGLUniformLocation | null;
  resizeObserver: ResizeObserver | null;
  isContextLost: boolean;
  startTime: number;
  lastFrameTime: number;
  pixelRatio: number;
  targetMouseX: number;
  targetMouseY: number;
  currentMouseX: number;
  currentMouseY: number;
};

const FRAME_INTERVAL = 1000 / 60;
const FULLSCREEN_TRIANGLE = new Float32Array([-1, -1, 3, -1, -1, 3]);

const VERTEX_SHADER_SOURCE = `
attribute vec2 position;
void main() {
    gl_Position = vec4(position, 0.0, 1.0);
}
`.replace(/\r/g, '');

const FRAGMENT_SHADER_SOURCE = `
precision highp float;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;

// 2D Hash function for noise generation
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// 2D Value Noise Layer
float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
               mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
}

// 3-Octave Fractional Brownian Motion (fBm)
float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0);
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < 3; i++) {
        v += a * noise(p);
        p = rot * p * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}

void main() {
    // Normalize coordinates and account for aspect ratio
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    st.x *= u_resolution.x / u_resolution.y;

    // Inertia Vector Mapping for cursor distortion
    vec2 mouseNormalized = u_mouse / u_resolution.xy;
    mouseNormalized.x *= u_resolution.x / u_resolution.y;
    float mouseDist = distance(st, mouseNormalized);
    
    // Distort coordinates based on proximity to interactive cursor
    float distortion = exp(-mouseDist * 4.5) * 0.15;
    vec2 distortedSt = st + vec2(distortion * sin(u_time * 0.5), distortion * cos(u_time * 0.5));

    // Evolve noise mapping across temporal and spatial fields
    vec2 q = vec2(fbm(distortedSt + u_time * 0.04), fbm(distortedSt + vec2(1.0)));
    vec2 r = vec2(fbm(distortedSt + q + u_time * 0.02), fbm(distortedSt + q));
    float f = fbm(distortedSt + r);

    // Base Canvas Palette Configuration (#000000 Pitch Black Base)
    vec3 baseColor = vec3(0.0, 0.0, 0.0);
    
    // Target Accent Palette Configuration (Subtle Monochrome Silver Smoke)
    vec3 accentColor = vec3(0.55, 0.57, 0.60);
    
    // Mix colors based on noise calculations to generate dark ink swells
    vec3 color = mix(baseColor, accentColor, clamp(f * f * 1.8, 0.0, 0.08));
    
    // MATHEMATICAL EDGE VIGNETTE (Erases the square canvas artifact)
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    float vignette = uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y);
    vignette = clamp(pow(16.0 * vignette, 0.65), 0.0, 1.0);
    
    gl_FragColor = vec4(color * vignette, 1.0);
}
`.replace(/\r/g, '');

function createRuntime(): ShaderRuntime {
  return {
    rafId: null,
    gl: null,
    program: null,
    vertexShader: null,
    fragmentShader: null,
    buffer: null,
    resolutionLocation: null,
    mouseLocation: null,
    timeLocation: null,
    resizeObserver: null,
    isContextLost: false,
    startTime: 0,
    lastFrameTime: 0,
    pixelRatio: 1,
    targetMouseX: 0,
    targetMouseY: 0,
    currentMouseX: 0,
    currentMouseY: 0,
  };
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);

  if (!shader) {
    throw new Error('Unable to create WebGL shader.');
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? 'Unknown shader compile error.';
    gl.deleteShader(shader);
    throw new Error(message);
  }

  return shader;
}

function createProgram(gl: WebGLRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader) {
  const program = gl.createProgram();

  if (!program) {
    throw new Error('Unable to create WebGL program.');
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? 'Unknown shader link error.';
    gl.deleteProgram(program);
    throw new Error(message);
  }

  return program;
}

export default function ShaderBackground({ targetRef, className }: ShaderBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runtimeRef = useRef<ShaderRuntime>(createRuntime());

  useEffect(() => {
    const canvasElement = canvasRef.current;
    const targetElement = targetRef.current;
    const runtime = runtimeRef.current;

    if (!canvasElement || !targetElement) {
      return undefined;
    }

    const canvas = canvasElement;
    const target = targetElement;
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    function cancelFrame() {
      if (runtime.rafId !== null) {
        cancelAnimationFrame(runtime.rafId);
        runtime.rafId = null;
      }
    }

    function disposeGlResources() {
      cancelFrame();

      const gl = runtime.gl;

      if (gl) {
        if (runtime.program) {
          gl.deleteProgram(runtime.program);
        }

        if (runtime.vertexShader) {
          gl.deleteShader(runtime.vertexShader);
        }

        if (runtime.fragmentShader) {
          gl.deleteShader(runtime.fragmentShader);
        }

        if (runtime.buffer) {
          gl.deleteBuffer(runtime.buffer);
        }
      }

      runtime.gl = null;
      runtime.program = null;
      runtime.vertexShader = null;
      runtime.fragmentShader = null;
      runtime.buffer = null;
      runtime.resolutionLocation = null;
      runtime.mouseLocation = null;
      runtime.timeLocation = null;
    }

    function syncSize() {
      if (!runtime.gl) {
        return;
      }

      const cssWidth = Math.max(1, target.clientWidth);
      const cssHeight = Math.max(1, target.clientHeight);
      const pixelRatio = Math.min(Math.max(1, window.devicePixelRatio || 1), 2);
      const width = Math.max(1, Math.floor(cssWidth * pixelRatio));
      const height = Math.max(1, Math.floor(cssHeight * pixelRatio));

      runtime.pixelRatio = pixelRatio;

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        runtime.gl.viewport(0, 0, canvas.width, canvas.height);
        runtime.targetMouseX = width * 0.5;
        runtime.targetMouseY = height * 0.5;
        runtime.currentMouseX = width * 0.5;
        runtime.currentMouseY = height * 0.5;
      }
    }

    function updatePointerFromEvent(event: PointerEvent) {
      let offsetX = 0;
      let offsetY = 0;
      let node: HTMLElement | null = target;

      while (node) {
        offsetX += node.offsetLeft;
        offsetY += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
      }

      const cssX = Math.min(Math.max(event.pageX - offsetX, 0), target.clientWidth);
      const cssY = Math.min(Math.max(event.pageY - offsetY, 0), target.clientHeight);

      runtime.targetMouseX = cssX * runtime.pixelRatio;
      runtime.targetMouseY = (target.clientHeight - cssY) * runtime.pixelRatio;
    }

    function resetPointer() {
      runtime.targetMouseX = canvas.width * 0.5;
      runtime.targetMouseY = canvas.height * 0.5;
    }

    function render(timestamp: number) {
      if (runtime.isContextLost) {
        runtime.rafId = null;
        return;
      }

      runtime.rafId = requestAnimationFrame(render);

      if (timestamp - runtime.lastFrameTime < FRAME_INTERVAL) {
        return;
      }

      const gl = runtime.gl;

      if (
        !gl ||
        !runtime.program ||
        !runtime.resolutionLocation ||
        !runtime.mouseLocation ||
        !runtime.timeLocation
      ) {
        return;
      }

      runtime.lastFrameTime = timestamp;
      runtime.currentMouseX += (runtime.targetMouseX - runtime.currentMouseX) * 0.08;
      runtime.currentMouseY += (runtime.targetMouseY - runtime.currentMouseY) * 0.08;

      syncSize();

      gl.useProgram(runtime.program);
      gl.uniform2f(runtime.resolutionLocation, canvas.width, canvas.height);
      gl.uniform2f(runtime.mouseLocation, runtime.currentMouseX, runtime.currentMouseY);
      gl.uniform1f(runtime.timeLocation, (timestamp - runtime.startTime) * 0.001);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function initialize() {
      disposeGlResources();

      if (motionQuery.matches) {
        return;
      }

      const gl = canvas.getContext('webgl', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
      });

      if (!gl) {
        return;
      }

      runtime.gl = gl;

      try {
        const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
        runtime.vertexShader = vertexShader;

        const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
        runtime.fragmentShader = fragmentShader;

        const program = createProgram(gl, vertexShader, fragmentShader);
        runtime.program = program;

        const buffer = gl.createBuffer();
        runtime.buffer = buffer;

        const positionLocation = gl.getAttribLocation(program, 'position');

        if (!buffer || positionLocation < 0) {
          throw new Error('Unable to create WebGL buffer or bind shader attribute.');
        }

        runtime.resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
        runtime.mouseLocation = gl.getUniformLocation(program, 'u_mouse');
        runtime.timeLocation = gl.getUniformLocation(program, 'u_time');
        runtime.isContextLost = false;
        runtime.startTime = performance.now();
        runtime.lastFrameTime = 0;

        gl.clearColor(0, 0, 0, 1);
        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, FULLSCREEN_TRIANGLE, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        syncSize();
        runtime.rafId = requestAnimationFrame(render);
      } catch (error) {
        console.error('ShaderBackground failed to initialize.', error);
        disposeGlResources();
      }
    }

    function handleContextLost(event: Event) {
      event.preventDefault();
      runtime.isContextLost = true;
      cancelFrame();
    }

    function handleContextRestored() {
      runtime.isContextLost = false;
      initialize();
    }

    function handleMotionPreferenceChange() {
      if (motionQuery.matches) {
        disposeGlResources();
      } else {
        initialize();
      }
    }

    runtime.resizeObserver = new ResizeObserver(syncSize);
    runtime.resizeObserver.observe(target);

    window.addEventListener('resize', syncSize);
    target.addEventListener('pointermove', updatePointerFromEvent);
    target.addEventListener('pointerleave', resetPointer);
    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);
    motionQuery.addEventListener('change', handleMotionPreferenceChange);

    initialize();

    return () => {
      window.removeEventListener('resize', syncSize);
      target.removeEventListener('pointermove', updatePointerFromEvent);
      target.removeEventListener('pointerleave', resetPointer);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      motionQuery.removeEventListener('change', handleMotionPreferenceChange);

      runtime.resizeObserver?.disconnect();
      runtime.resizeObserver = null;
      disposeGlResources();
    };
  }, [targetRef]);

  return (
    <div className={className ? 'shader-background ' + className : 'shader-background'} aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
