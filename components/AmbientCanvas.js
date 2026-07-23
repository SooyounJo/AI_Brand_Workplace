import { useEffect, useRef } from "react";

const VERT = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAG = `
precision mediump float;

varying vec2 v_uv;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;
uniform vec2 u_mouseDot;
uniform float u_mouseActive;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float wob(float t, float s, float a) {
  return sin(t * 0.52 + s * 6.283) * a + sin(t * 0.88 + s * 4.2) * a * 0.46;
}

float wob2(float t, float s, float a) {
  return sin(t * 0.31 + s * 5.1) * a + cos(t * 0.67 + s * 3.7) * a * 0.55;
}

vec2 drift(vec2 base, float t, float sx, float sy, float ax, float ay) {
  return base + vec2(sin(t * sx + ax) * ax, cos(t * sy + ay) * ay);
}

vec2 orbit(vec2 base, float t, float speed, float radius, float phase) {
  return base + vec2(cos(t * speed + phase), sin(t * speed * 0.86 + phase * 1.3)) * radius;
}

vec2 mouseShift(vec2 pos, vec2 mouse, float mouseOn, float strength) {
  if (mouseOn < 0.5) return pos;
  vec2 dir = mouse - pos;
  float pull = exp(-dot(dir, dir) * 4.2) * strength;
  return pos + dir * pull;
}

float goo(vec2 p, vec2 c, vec2 r) {
  vec2 d = (p - c) / r;
  return exp(-dot(d, d) * 0.52);
}

float gooBall(vec2 p, vec2 c, float r) {
  float d2 = dot(p - c, p - c);
  return (r * r) / (d2 + r * r * 0.28);
}

float pulseR(float t, float s, float base, float amount) {
  return base * (1.0 + amount * sin(t * 0.9 + s * 6.28) * 0.85);
}

float gooField(vec2 q, float t, vec2 mouse, float mouseOn) {
  float f = 0.0;
  vec2 flow = vec2(sin(t * 0.11) * 0.04, cos(t * 0.09) * 0.028);

  vec2 c0 = mouseShift(drift(vec2(-0.58, 0.02) + flow, t, 0.14, 0.11, 0.06, 0.05) + vec2(wob(t, 0.1, 0.055), wob(t, 0.2, 0.048)), mouse, mouseOn, 0.16);
  vec2 c1 = mouseShift(drift(vec2(-0.24, -0.04) + flow, t, 0.16, 0.13, 0.05, 0.04) + vec2(wob(t, 0.3, 0.062), wob(t, 0.4, 0.054)), mouse, mouseOn, 0.15);
  vec2 c2 = mouseShift(drift(vec2(0.06, 0.05) + flow, t, 0.12, 0.15, 0.07, 0.05) + vec2(wob(t, 0.5, 0.068), wob(t, 0.6, 0.058)), mouse, mouseOn, 0.17);
  vec2 c3 = mouseShift(drift(vec2(0.36, -0.03) + flow, t, 0.15, 0.12, 0.05, 0.045) + vec2(wob(t, 0.7, 0.058), wob(t, 0.8, 0.05)), mouse, mouseOn, 0.15);
  vec2 c4 = mouseShift(drift(vec2(0.64, 0.02) + flow, t, 0.13, 0.14, 0.055, 0.04) + vec2(wob(t, 0.9, 0.05), wob(t, 1.0, 0.044)), mouse, mouseOn, 0.14);

  f += goo(q, c0, vec2(pulseR(t, 0.2, 0.24, 0.14), pulseR(t, 0.3, 0.17, 0.12)));
  f += goo(q, c1, vec2(pulseR(t, 0.4, 0.26, 0.13), pulseR(t, 0.5, 0.19, 0.11)));
  f += goo(q, c2, vec2(pulseR(t, 0.6, 0.28, 0.15), pulseR(t, 0.7, 0.2, 0.12)));
  f += goo(q, c3, vec2(pulseR(t, 0.8, 0.25, 0.12), pulseR(t, 0.9, 0.18, 0.1)));
  f += goo(q, c4, vec2(pulseR(t, 1.0, 0.22, 0.11), pulseR(t, 1.1, 0.16, 0.09)));

  vec2 s0 = mouseShift(orbit(vec2(-0.44, 0.3) + flow + vec2(wob2(t, 1.1, 0.07), wob2(t, 1.2, 0.062)), t, 0.22, 0.07, 0.4), mouse, mouseOn, 0.12);
  vec2 s1 = mouseShift(orbit(vec2(-0.1, -0.32) + flow + vec2(wob2(t, 1.3, 0.068), wob2(t, 1.4, 0.06)), t, 0.19, 0.065, 1.1), mouse, mouseOn, 0.11);
  vec2 s2 = mouseShift(orbit(vec2(0.2, 0.34) + flow + vec2(wob2(t, 1.5, 0.064), wob2(t, 1.6, 0.058)), t, 0.24, 0.068, 2.3), mouse, mouseOn, 0.11);
  vec2 s3 = mouseShift(orbit(vec2(0.5, -0.3) + flow + vec2(wob2(t, 1.7, 0.06), wob2(t, 1.8, 0.054)), t, 0.2, 0.062, 3.7), mouse, mouseOn, 0.1);
  vec2 s4 = mouseShift(orbit(vec2(-0.68, -0.14) + flow + vec2(wob2(t, 1.9, 0.052), wob2(t, 2.0, 0.046)), t, 0.17, 0.055, 4.9), mouse, mouseOn, 0.09);
  vec2 s5 = mouseShift(orbit(vec2(0.74, 0.16) + flow + vec2(wob2(t, 2.1, 0.05), wob2(t, 2.2, 0.044)), t, 0.21, 0.058, 5.6), mouse, mouseOn, 0.09);

  f += gooBall(q, s0, pulseR(t, 2.5, 0.12, 0.22)) * 0.64;
  f += gooBall(q, s1, pulseR(t, 2.6, 0.11, 0.2)) * 0.6;
  f += gooBall(q, s2, pulseR(t, 2.7, 0.105, 0.21)) * 0.58;
  f += gooBall(q, s3, pulseR(t, 2.8, 0.1, 0.19)) * 0.56;
  f += gooBall(q, s4, pulseR(t, 2.9, 0.095, 0.18)) * 0.52;
  f += gooBall(q, s5, pulseR(t, 3.0, 0.09, 0.17)) * 0.5;

  if (mouseOn > 0.5) {
    f += gooBall(q, mouse, pulseR(t, 3.4, 0.12, 0.18)) * 0.52;
    f += goo(q, mouse, vec2(0.16, 0.12)) * 0.34;
  }

  return f;
}

vec2 fluidWarp(vec2 p, float t, vec2 mouse, float mouseOn) {
  vec2 q = p;
  q.x += 0.028 * sin(q.y * 4.0 + t * 0.42);
  q.y += 0.024 * cos(q.x * 3.2 - t * 0.38);
  q += 0.012 * vec2(sin(q.y * 7.0 + t * 0.52), cos(q.x * 5.8 - t * 0.44));

  if (mouseOn > 0.5) {
    vec2 dir = q - mouse;
    float d2 = dot(dir, dir);
    float bulge = exp(-d2 * 3.8) * 0.058;
    q -= dir * bulge;
  }

  return q;
}

float blurField(vec2 q, float t, vec2 mouse, float mouseOn) {
  vec2 s = vec2(0.052, 0.072);
  float f = gooField(q, t, mouse, mouseOn);
  f += gooField(q + vec2(s.x, 0.0), t, mouse, mouseOn);
  f += gooField(q - vec2(s.x, 0.0), t, mouse, mouseOn);
  f += gooField(q + vec2(0.0, s.y), t, mouse, mouseOn);
  f += gooField(q - vec2(0.0, s.y), t, mouse, mouseOn);
  return f * 0.2;
}

vec3 baseColor(vec2 uv, float t, vec2 mouse, float mouseOn) {
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 parallax = mouse * mouseOn * vec2(0.045, 0.032);
  vec2 p = (uv - 0.5 + parallax) * vec2(aspect, 1.0);
  vec2 q = fluidWarp(p, t, mouse, mouseOn);

  float field = blurField(q, t, mouse, mouseOn);
  float gooPulse = sin(t * 1.35 + field * 2.4) * 0.018;

  float body = smoothstep(0.24, 0.76, field + gooPulse * 0.08);
  float glow = smoothstep(0.04, 0.56, field + gooPulse * 0.12);
  float halo = (glow - body * 0.44) * 1.0;
  float core = smoothstep(0.46, 1.1, field + gooPulse * 0.05);

  vec3 gray = vec3(0.753, 0.737, 0.714);
  vec3 peach = vec3(0.99, 0.56, 0.22);
  vec3 orangeDeep = vec3(0.93, 0.25, 0.01);
  vec3 orange = vec3(1.0, 0.271, 0.0);

  vec3 col = gray;
  col = mix(col, peach, clamp(halo, 0.0, 1.0));
  col = mix(col, mix(orangeDeep, orange, core * 0.68 + 0.32), body);
  col = mix(col, vec3(1.0, 0.32, 0.05), core * body * 0.07);
  col *= 1.0 - body * 0.04;

  float hatch = sin((uv.x - uv.y) * 125.0 + t * 0.18) * (body + halo * 0.28) * 0.009;
  col -= vec3(hatch * 0.18, hatch * 0.08, 0.0);

  return col;
}

float filmGrain(vec2 fragCoord) {
  return hash(floor(fragCoord / 4.5)) * 2.0 - 1.0;
}

float lensMask(vec2 p, vec2 mouse, float t) {
  float pulse = 1.0 + 0.05 * sin(t * 11.0);
  float r = 0.048 * pulse;
  return 1.0 - smoothstep(r * 0.65, r, length(p - mouse));
}

void main() {
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 p = (v_uv - 0.5) * vec2(aspect, 1.0);
  float t = u_time;

  vec3 smoothCol = baseColor(v_uv, t, u_mouse, u_mouseActive);
  float grain = filmGrain(gl_FragCoord.xy);

  float lens = 0.0;
  float dotMask = 0.0;

  if (u_mouseActive > 0.5) {
    lens = lensMask(p, u_mouseDot, t);
    float d = length(p - u_mouseDot);
    dotMask = 1.0 - smoothstep(0.003, 0.006, d);
  }

  float g = grain * (1.0 - lens);
  vec3 col = smoothCol + g * 0.014;
  col = mix(col, smoothCol, lens * 0.55);
  col = mix(col, vec3(1.0), dotMask);

  gl_FragColor = vec4(col, 1.0);
}
`;

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(info || "Shader compile failed");
  }
  return shader;
}

function createProgram(gl, vertSource, fragSource) {
  const vert = createShader(gl, gl.VERTEX_SHADER, vertSource);
  const frag = createShader(gl, gl.FRAGMENT_SHADER, fragSource);
  const program = gl.createProgram();
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(info || "Program link failed");
  }
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  return program;
}

function getGL(canvas) {
  const opts = {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
    powerPreference: "high-performance",
    desynchronized: true,
  };
  return (
    canvas.getContext("webgl", opts) ||
    canvas.getContext("experimental-webgl", opts) ||
    canvas.getContext("webgl2", opts)
  );
}

export default function AmbientCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const markStatus = (status, detail) => {
      canvas.dataset.webgl = status;
      if (detail) canvas.dataset.webglDetail = detail;
    };

    const gl = getGL(canvas);
    if (!gl) {
      markStatus("failed", "context-unavailable");
      console.error("[AmbientCanvas] WebGL context unavailable");
      return undefined;
    }

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let program;
    try {
      program = createProgram(gl, VERT, FRAG);
    } catch (err) {
      markStatus("failed", "shader-error");
      canvas.style.opacity = "0";
      console.error("[AmbientCanvas] Shader error:", err);
      return undefined;
    }

    markStatus("active");
    canvas.style.opacity = "1";
    gl.clearColor(0.753, 0.737, 0.714, 1.0);

    const resLoc = gl.getUniformLocation(program, "u_resolution");
    const timeLoc = gl.getUniformLocation(program, "u_time");
    const mouseLoc = gl.getUniformLocation(program, "u_mouse");
    const mouseDotLoc = gl.getUniformLocation(program, "u_mouseDot");
    const mouseActiveLoc = gl.getUniformLocation(program, "u_mouseActive");
    const posLoc = gl.getAttribLocation(program, "a_position");

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    gl.useProgram(program);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    let raf = 0;
    let disposed = false;
    let running = true;
    const start = performance.now();
    const pointer = { x: 0, y: 0, tx: 0, ty: 0, active: 0 };
    let needsResize = true;

    const toScene = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      const uvx = (clientX - rect.left) / rect.width;
      const uvy = 1 - (clientY - rect.top) / rect.height;
      const aspect = rect.width / rect.height;
      return { x: (uvx - 0.5) * aspect, y: uvy - 0.5 };
    };

    const setPointer = (clientX, clientY) => {
      const pos = toScene(clientX, clientY);
      if (!pos) return;
      pointer.tx = pos.x;
      pointer.ty = pos.y;
      pointer.active = 1;
    };

    const onPointerMove = (e) => setPointer(e.clientX, e.clientY);
    const onPointerDown = (e) => setPointer(e.clientX, e.clientY);
    const onPointerEnter = (e) => setPointer(e.clientX, e.clientY);

    const onWindowLeave = (e) => {
      if (!e.relatedTarget && e.target === window.document) {
        pointer.active = 0;
      }
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width * dpr));
      const height = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
      needsResize = false;
    };

    const scheduleFrame = () => {
      if (!disposed && running && !reduceMotion) {
        raf = requestAnimationFrame(draw);
      }
    };

    const draw = (now) => {
      if (disposed || !running) return;
      if (needsResize) resize();

      const time = reduceMotion ? 0 : (now - start) / 1000;

      const follow = reduceMotion ? 1 : 0.12;
      pointer.x += (pointer.tx - pointer.x) * follow;
      pointer.y += (pointer.ty - pointer.y) * follow;

      gl.uniform2f(resLoc, canvas.width, canvas.height);
      gl.uniform1f(timeLoc, time);
      gl.uniform2f(mouseLoc, pointer.x, pointer.y);
      gl.uniform2f(mouseDotLoc, pointer.tx, pointer.ty);
      gl.uniform1f(mouseActiveLoc, pointer.active);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      scheduleFrame();
    };

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
        raf = 0;
        return;
      }
      running = true;
      scheduleFrame();
    };

    const onResize = () => {
      needsResize = true;
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    document.addEventListener("pointerenter", onPointerEnter, { passive: true });
    document.addEventListener("mouseout", onWindowLeave);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", onResize);

    resize();
    if (reduceMotion) {
      draw(performance.now());
    } else {
      scheduleFrame();
    }

    return () => {
      disposed = true;
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointerenter", onPointerEnter);
      document.removeEventListener("mouseout", onWindowLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, []);

  return (
    <canvas ref={canvasRef} className="ambient-canvas" aria-hidden="true" />
  );
}
