uniform sampler2D uTexture;
uniform vec2 uResolution;
varying vec2 vUv;
uniform float uBlurAmount;

void main() {
    vec2 texel = 1.0 / uResolution;
    vec4 color = vec4(0.0);

    for (int x = -4; x <= 4; x++) {
        for (int y = -4; y <= 4; y++) {
            vec2 offset = vec2(float(x), float(y)) * texel * uBlurAmount;
            color += texture2D(uTexture, vUv + offset);
        }
    }

    color /= 81.0; // 9x9 blur kernel
    gl_FragColor = color;
}
