
uniform sampler2D uTexture1;
uniform float uTime;
uniform vec2 uResolution;
varying vec2 vUv;



float bicubic(float v0, float v1, float v2, float v3, float x) {
    float p = (v3 - v2) - (v0 - v1);
    float q = (v0 - v1) - p;
    float r = v2 - v0;
    float s = v1;
    return p*x*x*x + q*x*x + r*x + s;
}

float calc_sin(vec2 uv,float freq,float amp,float angle,float offset)
{
    float pos=cos(angle)*uv.x+sin(angle)*uv.y;
    pos*=freq;
    pos+=offset;
    float res=sin(pos)*amp;
    return res;
}

vec2 calc_sinder(vec2 uv,float freq,float amp,float angle,float offset)
{
    float pos=cos(angle)*uv.x+sin(angle)*uv.y;
    pos*=freq;
    pos+=offset;
    float res=amp*cos(pos)*freq;
    return vec2(res*cos(angle),res*sin(angle));
}


vec2 randstate=vec2(42356.0,69.0);
float rand()
{
  float res=0.5 + 0.5 * 
     fract(sin(dot(randstate.xy, vec2(12.9898, 78.233)))* 43758.5453);
  randstate*=(res*0.2)+1.0;
  return res;
}

float wave(vec2 uv,int size,float mult,vec2 start)
{
    float result=0.0;
    float freq=start.x;
    float amp=start.y;
    for(int i=0;i<size;i++){
        result+=calc_sin(uv,freq,amp,freq*5.35235,rand()*5.0+uTime*2.0);
        freq*=mult;
        amp/=mult;
    }
    return result;
}

vec2 wave_der(vec2 uv,int size,float mult,vec2 start)
{
    vec2 result=vec2(0.0);
    float freq=start.x;
    float amp=start.y;
    for(int i=0;i<size;i++){
        result+=calc_sinder(uv,freq,amp,freq*5.35235*freq,rand()*5.0+uTime*2.0);
        freq*=mult;
        amp/=mult;
    }
    return result;
}



void main() {
    // normalize the coordinates to the aspect ratio
    float aspect = uResolution.x / uResolution.y;
    vec2 coord = (vUv-vec2(0.5,0.5))*uResolution;
    // detect the samallest side and adjust the uv to be centered

    
    vec2 uv = (coord / uResolution);
    float change = 0.75;
    if (aspect > change) {
        uv.x *= aspect;
        
    } else {
        uv *= change;
        uv.y /= aspect;
        
    }
    uv += vec2(0.5,0.5);

    float effect_mult=0.005;
    if (aspect<change){
        effect_mult=0.005;
    }

    vec2 offset = wave_der(uv,10,1.8,vec2(0.5,0.3));
    vec4 textureColor = texture2D(uTexture1, uv-offset*effect_mult);
    if(textureColor.r > 0.5) {
        gl_FragColor = vec4(0.3,0.3,0.3,1.0);
    } else {
    gl_FragColor =vec4(0.0,0.0,0.0,0.0);
    }
    float brig=smoothstep(0.0,0.5,textureColor.r);
    gl_FragColor=vec4(brig,brig,brig,brig)*vec4(0.1,0.1,0.1,1.0);
}
        