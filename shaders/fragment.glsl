uniform sampler2D globeTexture; // Day map
uniform sampler2D nightTexture; // Night lights map
uniform vec3 lightDirection;    // Sunlight direction

varying vec2 vertexUV;
varying vec3 vertexNormal;

void main(){  
    // Day/night blend factor
    float dayFactor = dot(vertexNormal, normalize(lightDirection));
    dayFactor = clamp(dayFactor, 0.0, 1.0);

    // Sample textures
    vec3 dayColor = texture2D(globeTexture, vertexUV).rgb;
    vec3 nightColor = texture2D(nightTexture, vertexUV).rgb;

    // Blend between day and night
    vec3 earthColor = mix(nightColor, dayColor, dayFactor);

    // Atmosphere effect
    float intensity = 1.05 - dot(vertexNormal, vec3(0.0, 0.0, 1.0));
    vec3 atmosphere = vec3(0.3, 0.6, 1.0) * pow(intensity, 1.5);
    
    gl_FragColor = vec4(atmosphere + earthColor, 1.0);
}
