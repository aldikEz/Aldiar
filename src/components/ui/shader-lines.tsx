"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    THREE?: any;
  }
}

type ShaderAnimationProps = {
  isActive?: boolean;
};

export function ShaderAnimation({ isActive = false }: ShaderAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isActiveRef = useRef(isActive);
  const sceneRef = useRef<{
    camera: any;
    scene: any;
    renderer: any;
    uniforms: any;
    animationId: number | null;
    renderFrame: (() => void) | null;
    cleanupResize: (() => void) | null;
  }>({
    camera: null,
    scene: null,
    renderer: null,
    uniforms: null,
    animationId: null,
    renderFrame: null,
    cleanupResize: null,
  });

  useEffect(() => {
    isActiveRef.current = isActive;

    if (isActive && sceneRef.current.renderFrame && sceneRef.current.animationId === null) {
      sceneRef.current.renderFrame();
    }

    if (!isActive && sceneRef.current.animationId !== null) {
      cancelAnimationFrame(sceneRef.current.animationId);
      sceneRef.current.animationId = null;
      sceneRef.current.renderer?.render(sceneRef.current.scene, sceneRef.current.camera);
    }
  }, [isActive]);

  useEffect(() => {
    let isMounted = true;
    const script = document.createElement("script");

    function cleanupScene() {
      if (sceneRef.current.animationId !== null) {
        cancelAnimationFrame(sceneRef.current.animationId);
      }

      sceneRef.current.cleanupResize?.();
      sceneRef.current.renderer?.dispose();

      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }

      sceneRef.current = {
        camera: null,
        scene: null,
        renderer: null,
        uniforms: null,
        animationId: null,
        renderFrame: null,
        cleanupResize: null,
      };
    }

    function initThreeJS() {
      if (!isMounted || !containerRef.current || !window.THREE) {
        return;
      }

      cleanupScene();

      const THREE = window.THREE;
      const container = containerRef.current;
      const camera = new THREE.Camera();
      camera.position.z = 1;

      const scene = new THREE.Scene();
      const geometry = new THREE.PlaneBufferGeometry(2, 2);
      const uniforms = {
        time: { type: "f", value: 1.0 },
        resolution: { type: "v2", value: new THREE.Vector2() },
      };

      const vertexShader = `
        void main() {
          gl_Position = vec4( position, 1.0 );
        }
      `;

      const fragmentShader = `
        #define TWO_PI 6.2831853072
        #define PI 3.14159265359

        precision highp float;
        uniform vec2 resolution;
        uniform float time;

        float random (in float x) {
          return fract(sin(x)*1e4);
        }

        float random (vec2 st) {
          return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
        }

        varying vec2 vUv;

        void main(void) {
          vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);

          vec2 fMosaicScal = vec2(4.0, 2.0);
          vec2 vScreenSize = vec2(256,256);
          uv.x = floor(uv.x * vScreenSize.x / fMosaicScal.x) / (vScreenSize.x / fMosaicScal.x);
          uv.y = floor(uv.y * vScreenSize.y / fMosaicScal.y) / (vScreenSize.y / fMosaicScal.y);

          float t = time*0.06+random(uv.x)*0.4;
          float lineWidth = 0.0008;

          vec3 color = vec3(0.0);
          for(int j = 0; j < 3; j++){
            for(int i=0; i < 5; i++){
              color[j] += lineWidth*float(i*i) / abs(fract(t - 0.01*float(j)+float(i)*0.01)*1.0 - length(uv));
            }
          }

          gl_FragColor = vec4(color[2],color[1],color[0],1.0);
        }
      `;

      const material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader,
        fragmentShader,
      });
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      container.appendChild(renderer.domElement);

      const onWindowResize = () => {
        if (!containerRef.current) {
          return;
        }

        const width = Math.max(1, containerRef.current.clientWidth);
        const height = Math.max(1, containerRef.current.clientHeight);
        renderer.setSize(width, height, false);
        uniforms.resolution.value.x = renderer.domElement.width;
        uniforms.resolution.value.y = renderer.domElement.height;
      };

      window.addEventListener("resize", onWindowResize, false);
      onWindowResize();

      sceneRef.current = {
        camera,
        scene,
        renderer,
        uniforms,
        animationId: null,
        renderFrame: null,
        cleanupResize: () => window.removeEventListener("resize", onWindowResize, false),
      };

      const renderFrame = () => {
        if (!isActiveRef.current) {
          sceneRef.current.animationId = null;
          renderer.render(scene, camera);
          return;
        }

        uniforms.time.value += 0.05;
        renderer.render(scene, camera);
        sceneRef.current.animationId = requestAnimationFrame(renderFrame);
      };

      sceneRef.current.renderFrame = renderFrame;
      renderer.render(scene, camera);

      if (isActiveRef.current) {
        renderFrame();
      }
    }

    if (window.THREE) {
      initThreeJS();
    } else {
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/89/three.min.js";
      script.async = true;
      script.onload = initThreeJS;
      document.head.appendChild(script);
    }

    return () => {
      isMounted = false;
      cleanupScene();

      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0 h-full w-full pointer-events-none" />;
}
