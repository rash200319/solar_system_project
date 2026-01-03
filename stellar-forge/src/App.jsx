import { useState, useRef, useEffect, useMemo, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars, CameraShake, Html, useTexture } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'

// --- 0. PHYSICS ENGINE ---
function useStarPhysics(mass, age) {
  return useMemo(() => {
    const lifespan = 10 / (Math.pow(mass, 2.5)) + 0.5; 
    const redGiantStart = lifespan;
    const deathStart = lifespan * 1.2; 

    const baseSize = Math.log(mass + 1) * 1.5;

    if (age < redGiantStart) {
      const colorTemp = mass > 2 ? '#aaddff' : (mass > 0.8 ? '#ffaa00' : '#ff5500');
      return {
        stage: 'Main Sequence',
        color: colorTemp, 
        scale: baseSize, 
        description: `Stable Fusion.\nEst. Lifespan: ${lifespan.toFixed(2)} BY`
      }
    } 
    else if (age >= redGiantStart && age < deathStart) {
      const progress = (age - redGiantStart) / (deathStart - redGiantStart); 
      return {
        stage: 'Red Giant',
        color: '#ff0000', 
        scale: baseSize * (1 + (progress * 5)), 
        description: `Hydrogen Depleted.\nCore Collapsing.`
      }
    } 
    else {
      const isSupernova = mass > 8; 
      return {
        stage: isSupernova ? 'SUPERNOVA' : 'White Dwarf',
        color: '#ffffff', 
        scale: isSupernova ? baseSize * 0.5 : baseSize * 0.2, 
        description: isSupernova ? 'Core collapse imminent.' : 'Outer layers shed.\nCore remnant remains.'
      }
    }
  }, [mass, age])
}

// Replace the existing getSystemPhysics function
function getSystemPhysics(starMass, starAge) {
  const lifespan = 10 / (Math.pow(starMass, 2.5)) + 0.5;
  const redGiantEnd = lifespan * 1.2;
  
  let massMultiplier = 1.0;
  
  if (starAge > lifespan && starAge < redGiantEnd) {
    const phaseProgress = (starAge - lifespan) / (redGiantEnd - lifespan);
    // INCREASED EFFECT: Mass drops to 40% (0.6 loss) instead of 70%. 
    // This causes a stronger "drifting away" effect as the star grows.
    massMultiplier = 1.0 - (phaseProgress * 0.6); 
  } else if (starAge >= redGiantEnd) {
    massMultiplier = 0.4; // White dwarf remnant mass
  }

  return { 
      currentMass: starMass * massMultiplier, 
      lifespan, 
      redGiantEnd 
  };
}

// --- 1. BACKGROUND ---
function StarField() {
  return (
    <>
      <color attach="background" args={['#050505']} />
      <Stars radius={300} depth={50} count={6000} factor={4} saturation={0} fade speed={1} />
    </>
  )
}

// --- 2. CAMERA RIG ---
function CameraRig({ focusRef, controlsRef }) {
  const vec = new THREE.Vector3()
  useFrame((state, delta) => {
    if (focusRef?.current) {
      const targetObj = focusRef.current
      targetObj.getWorldPosition(vec)
      controlsRef.current.target.lerp(vec, 0.1)
      const offset = new THREE.Vector3(3, 2, 3) 
      state.camera.position.lerp(vec.clone().add(offset), 0.05)
      controlsRef.current.update()
    } else {
      controlsRef.current.target.lerp(new THREE.Vector3(0, 0, 0), 0.1)
      controlsRef.current.update()
    }
  })
  return null
}

// --- 3a. INNER ASTEROID BELT ---
function AsteroidBelt({ mass, age, exploded, starScale }) {
  const count = 600; 
  const mesh = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const asteroids = useMemo(() => {
    return new Array(count).fill().map(() => ({
      angle: Math.random() * Math.PI * 2,
      dist: 10.5 + Math.random() * 2.5, 
      speed: 0.5 + Math.random() * 0.5,
      yOffset: (Math.random() - 0.5) * 1.5, 
      size: 0.05 + Math.random() * 0.08,
      rotationSpeed: Math.random(),
      rotationAxis: new THREE.Vector3(Math.random(), Math.random(), Math.random()).normalize()
    }))
  }, []);

  useFrame((state, delta) => {
    if (!mesh.current) return;
    const { currentMass, lifespan, redGiantEnd } = getSystemPhysics(mass, age);
    
    // Calculate Scaling Factors
    const agingExpansion = mass / currentMass;
    const initialSystemScale = Math.pow(mass, 0.5);
    const expansionFactor = agingExpansion * initialSystemScale;
    
    asteroids.forEach((data, i) => {
      const currentDist = data.dist * expansionFactor;
      const currentSpeed = (data.speed * Math.sqrt(currentMass)) / initialSystemScale;
      
      data.angle += currentSpeed * delta * 0.2;
      const x = Math.cos(data.angle) * currentDist;
      const z = Math.sin(data.angle) * currentDist;

      dummy.position.set(x, data.yOffset, z);
      dummy.rotateOnAxis(data.rotationAxis, data.rotationSpeed * delta);
      
      let s = data.size;
      if (age > lifespan && age < redGiantEnd && starScale > currentDist * 0.9) s = 0;
      if (exploded) s = 0; 

      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[null, null, count]}>
      <dodecahedronGeometry args={[1, 0]} /> 
      <meshStandardMaterial color="#887766" roughness={0.9} />
    </instancedMesh>
  )
}

// --- 3b. KUIPER BELT ---
function KuiperBelt({ mass, age, exploded, starScale }) {
    const count = 1200; 
    const mesh = useRef();
    const dummy = useMemo(() => new THREE.Object3D(), []);
   
    const asteroids = useMemo(() => {
      return new Array(count).fill().map(() => ({
        angle: Math.random() * Math.PI * 2,
        dist: 30.0 + Math.random() * 20.0, 
        speed: 0.1 + Math.random() * 0.2,  
        yOffset: (Math.random() - 0.5) * 3.0, 
        size: 0.08 + Math.random() * 0.1,
        rotationSpeed: Math.random() * 0.5,
        rotationAxis: new THREE.Vector3(Math.random(), Math.random(), Math.random()).normalize()
      }))
    }, []);
   
    useFrame((state, delta) => {
      if (!mesh.current) return;
      const { currentMass, lifespan, redGiantEnd } = getSystemPhysics(mass, age);
      
      // Calculate Scaling Factors
      const agingExpansion = mass / currentMass;
      const initialSystemScale = Math.pow(mass, 0.5);
      const expansionFactor = agingExpansion * initialSystemScale;
      
      asteroids.forEach((data, i) => {
        const currentDist = data.dist * expansionFactor;
        const currentSpeed = (data.speed * Math.sqrt(currentMass)) / initialSystemScale;
        
        data.angle += currentSpeed * delta * 0.1; 
        const x = Math.cos(data.angle) * currentDist;
        const z = Math.sin(data.angle) * currentDist;
   
        dummy.position.set(x, data.yOffset, z);
        dummy.rotateOnAxis(data.rotationAxis, data.rotationSpeed * delta);
        
        let s = data.size;
        if (exploded) s = 0; 
   
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        mesh.current.setMatrixAt(i, dummy.matrix);
      });
      mesh.current.instanceMatrix.needsUpdate = true;
    });
   
    return (
      <instancedMesh ref={mesh} args={[null, null, count]}>
        <dodecahedronGeometry args={[1, 0]} /> 
        <meshStandardMaterial color="#88aabb" roughness={0.6} /> 
      </instancedMesh>
    )
  }

// --- 4. PLANETS ---
function PlanetarySystem({ starScale, exploded, mass, starAge, setFocus, setSelectPlanet }) {
  const planets = useMemo(() => [
    { 
      name: 'MERCURY', baseDist: 3.5, size: 0.15, speed: 2.0, texture: '/textures/mercury.jpg',
      realDiameter: '4,880 km', temp: '167°C', day: '59 Earth days',
      desc: 'The smallest planet. It shrinks as it cools, creating massive cliffs on its surface.'
    }, 
    { 
      name: 'VENUS', baseDist: 5.0, size: 0.25, speed: 1.5, texture: '/textures/venus.jpg',
      realDiameter: '12,104 km', temp: '464°C', day: '243 Earth days',
      desc: 'Hottest planet in the system due to a runaway greenhouse effect. Spins backwards.'
    }, 
    { 
      name: 'EARTH', baseDist: 7.0, size: 0.3,  speed: 1.0, texture: '/textures/earth.jpg', hasMoon: true,
      realDiameter: '12,742 km', temp: '15°C', day: '24 hours',
      desc: 'The only known world to harbor life. 70% of the surface is covered in water.'
    }, 
    { 
      name: 'MARS', baseDist: 9.0, size: 0.2,  speed: 0.8, texture: '/textures/mars.jpg',
      realDiameter: '6,779 km', temp: '-65°C', day: '24h 37m',
      desc: 'The Red Planet. Home to Olympus Mons, the largest volcano in the solar system.'
    }, 
    { 
      name: 'JUPITER', baseDist: 14.0, size: 0.8, speed: 0.5, texture: '/textures/jupiter.jpg',
      realDiameter: '139,820 km', temp: '-110°C', day: '9h 56m',
      desc: 'A gas giant with a mass one-thousandth that of the Sun, but two-and-a-half times that of all other planets combined.'
    }, 
    { 
      name: 'SATURN', baseDist: 19.0, size: 0.7, speed: 0.4, texture: '/textures/saturn.jpg', hasRings: true, ringColor: '#cba',
      realDiameter: '116,460 km', temp: '-140°C', day: '10h 42m',
      desc: 'Famous for its prominent ring system, composed mainly of ice particles, with a smaller amount of rocky debris.'
    }, 
    { 
      name: 'URANUS', baseDist: 24.0, size: 0.5, speed: 0.3, texture: '/textures/uranus.jpg',
      realDiameter: '50,724 km', temp: '-195°C', day: '17h 14m',
      desc: 'It has the coldest planetary atmosphere in the Solar System. It rotates on its side.'
    }, 
    { 
      name: 'NEPTUNE', baseDist: 28.0, size: 0.5, speed: 0.2, texture: '/textures/neptune.jpg',
      realDiameter: '49,244 km', temp: '-200°C', day: '16h 6m',
      desc: 'The windiest planet, with supersonic winds reaching 2,100 km/h.'
    },
    { 
      name: 'PLUTO', baseDist: 35.0, size: 0.25, speed: 0.15, texture: '/textures/pluto.jpg', isEccentric: true, inclination: 0.3, eccentricity: 0.2,
      realDiameter: '2,376 km', temp: '-229°C', day: '153 hours',
      desc: 'A dwarf planet in the Kuiper belt. It was the first and the largest Kuiper belt object to be discovered.'
    } 
  ], [])

  return (
    <group>
      {planets.map((planet, i) => (
        <SinglePlanet key={i} data={planet} starScale={starScale} exploded={exploded} starMass={mass} starAge={starAge} setFocus={setFocus} setSelectPlanet={setSelectPlanet} />
      ))}
    </group>
  )
}

// Replace the existing SinglePlanet function
function SinglePlanet({ data, starScale, exploded, starMass, starAge, setFocus, setSelectPlanet }) {
  const mesh = useRef()
  const moonMesh = useRef()
  const orbitRing = useRef()
  
  const [angle, setAngle] = useState(Math.random() * Math.PI * 2)
  const [moonAngle, setMoonAngle] = useState(0)
  const [isDead, setIsDead] = useState(false)
  const [hovered, setHover] = useState(false)
  
  const textureMap = useTexture(data.texture)
  const moonTexture = useTexture(data.hasMoon ? '/textures/moon.jpg' : '/textures/mercury.jpg') 

  useFrame((state, delta) => {
    if (exploded || isDead) return; 

    const { currentMass, lifespan, redGiantEnd } = getSystemPhysics(starMass, starAge);
    
    // 1. EXPANSION DUE TO AGING (Star loses mass -> Planet drifts out)
    const agingExpansion = starMass / currentMass;

    // 2. SCALING DUE TO INITIAL MASS (Bigger Star -> Wider System)
    // We use Math.pow(starMass, 0.5) to scale distances by the square root of the mass.
    // e.g., Mass 1 = 1x dist, Mass 4 = 2x dist, Mass 9 = 3x dist.
    const initialSystemScale = Math.pow(starMass, 0.5);
    
    // -- Physics Calculation --
    // Combine base distance + initial mass scaling + aging expansion
    const currentBaseDist = data.baseDist * initialSystemScale * agingExpansion;
    
    // Calculate speed (Kepler's laws approximated)
    const currentSpeed = (data.speed * Math.sqrt(currentMass)) / initialSystemScale;

    setAngle(a => a + (delta * currentSpeed * 0.2)) 
    
    // -- Position Logic --
    let x, y, z;
    
    if (data.isEccentric) {
        const e = data.eccentricity;
        const r = (currentBaseDist * (1 - e*e)) / (1 + e * Math.cos(angle));
        let x0 = r * Math.cos(angle);
        let z0 = r * Math.sin(angle);
        y = z0 * Math.sin(data.inclination);
        z = z0 * Math.cos(data.inclination);
        x = x0; 
    } else {
        x = Math.cos(angle) * currentBaseDist;
        y = 0;
        z = Math.sin(angle) * currentBaseDist;
    }

    // Death Logic
    const distFromCenter = Math.sqrt(x*x + z*z); 
    if (starAge > lifespan && starAge < redGiantEnd) {
        // If the star has grown larger than the planet's current distance
        if (starScale > distFromCenter * 0.95) {
            setIsDead(true);
            if (setFocus) setFocus(null); 
            if (setSelectPlanet) setSelectPlanet(null);
        }
    }

    if (mesh.current) {
      mesh.current.position.lerp(new THREE.Vector3(x, y, z), 0.1)
      mesh.current.rotation.y += delta * 0.5; 
      
      if (data.hasMoon && moonMesh.current) {
         setMoonAngle(ma => ma + delta * 3)
         moonMesh.current.position.set(Math.cos(moonAngle) * 0.6, 0, Math.sin(moonAngle) * 0.6) 
      }
    }

    // Update Orbit Ring (Visual)
    if (orbitRing.current) {
        if (data.isEccentric) {
            orbitRing.current.visible = false; 
        } else {
            orbitRing.current.scale.lerp(new THREE.Vector3(currentBaseDist, currentBaseDist, 1), 0.1)
        }
    }
  })

  if (isDead) return null;

  const handleClick = (e) => {
      e.stopPropagation();
      setFocus(mesh); 
      setSelectPlanet(data);
  }

  return (
    <>
      {!exploded && (
        <mesh ref={orbitRing} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.99, 1.0, 128]} /> 
          <meshBasicMaterial color={hovered ? "#00ffff" : "#444"} opacity={hovered ? 0.6 : 0.2} transparent side={THREE.DoubleSide} />
        </mesh>
      )}

      <group ref={mesh} onClick={handleClick} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
        <mesh visible={true}>
            <sphereGeometry args={[1.5, 16, 16]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        <mesh castShadow receiveShadow>
          <sphereGeometry args={[data.size, 32, 32]} />
          <meshStandardMaterial map={textureMap} color={exploded ? '#111' : (hovered ? '#aaf' : 'white')} roughness={0.8} />
        </mesh>
        
        {data.hasMoon && !exploded && (
          <mesh ref={moonMesh} castShadow receiveShadow>
              <sphereGeometry args={[0.08, 16, 16]} />
              <meshStandardMaterial map={moonTexture} />
          </mesh>
        )}
        
        {data.hasRings && !exploded && (
          <mesh rotation={[-Math.PI / 2 + 0.5, 0, 0]} receiveShadow>
            <ringGeometry args={[data.size * 1.4, data.size * 2.4, 64]} />
            <meshStandardMaterial color={data.ringColor} opacity={0.7} transparent side={THREE.DoubleSide} />
          </mesh>
        )}

        {!exploded && hovered && (
           <Html distanceFactor={10} style={{ pointerEvents: 'none' }}>
            <div className="planet-label">{data.name}</div>
          </Html>
        )}
      </group>
    </>
  )
}

// --- 5. SUN ---
function Star({ settings, exploded, setFocus, setSelectPlanet }) {
  const mesh = useRef()
  const materialRef = useRef()
  const sunTexture = useTexture('/textures/sun_noise.jpg') 

  useEffect(() => {
    if (materialRef.current) {
        const targetColor = new THREE.Color(exploded ? "white" : settings.color)
        materialRef.current.color = targetColor
        materialRef.current.emissive = targetColor
    }
  }, [settings.color, exploded])

  useFrame((state, delta) => {
    if (mesh.current) {
      mesh.current.rotation.y += delta * 0.05
      const targetScale = exploded ? 20 : settings.scale
      mesh.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), exploded ? 0.1 : 0.05)
    }
  })

  const handleClick = (e) => {
      e.stopPropagation();
      setFocus(null);
      setSelectPlanet(null);
  }

  return (
    <mesh ref={mesh} onClick={handleClick}>
      <sphereGeometry args={[1, 64, 64]} />
      <meshStandardMaterial ref={materialRef} map={sunTexture} emissiveMap={sunTexture} emissiveIntensity={3} transparent opacity={1} />
      <pointLight intensity={3} color={exploded ? "white" : settings.color} distance={200} decay={1} castShadow />
    </mesh>
  )
}

function Shockwave({ exploded }) {
  const mesh = useRef()
  useFrame(() => {
    if (mesh.current && exploded) {
      mesh.current.scale.setScalar(THREE.MathUtils.lerp(mesh.current.scale.x, 60, 0.05))
      mesh.current.material.opacity = THREE.MathUtils.lerp(mesh.current.material.opacity, 0, 0.05)
    } else if (mesh.current) {
      mesh.current.scale.set(1, 1, 1); mesh.current.material.opacity = 1
    }
  })
  if (!exploded) return null
  return <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1, 1.2, 32]} /><meshBasicMaterial color="white" transparent side={THREE.DoubleSide} /></mesh>
}

// --- 6. UI COMPONENTS ---

const UIStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Rajdhani:wght@300;500;700&display=swap');
    
    body { 
      margin: 0; 
      font-family: 'Rajdhani', sans-serif; 
      overflow: hidden; 
      /* Prevents pull-to-refresh on mobile */
      overscroll-behavior: none;
    }

    /* --- DESKTOP DEFAULTS --- */
    .hud-panel {
      background: rgba(10, 10, 15, 0.6); backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 0 20px rgba(0,0,0,0.5);
      border-left: 3px solid #00ffff; padding: 20px; border-radius: 4px; color: white; text-transform: uppercase;
    }

    /* Planet Detail Panel (Desktop: Right Side) */
    .planet-panel {
      background: rgba(10, 10, 15, 0.85); backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: -5px 0 20px rgba(0,0,0,0.7);
      border-right: 3px solid #ff0055; padding: 25px; border-radius: 4px; color: white;
      position: absolute; right: 0; top: 0; bottom: 0; width: 300px;
      transform: translateX(100%); transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      display: flex; flex-direction: column; z-index: 20;
      overflow-y: auto; /* Allow scroll if content is tall */
    }
    .planet-panel.active { transform: translateX(0); }

    /* Controls Container */
    .controls-container {
      position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%);
      display: flex; gap: 20px; alignItems: flex-end; pointer-events: auto; width: auto;
    }
    .controls-inner {
      display: flex; gap: 30px; padding: 15px 30px; border-radius: 40px; align-items: center;
    }

    /* Typography & Elements */
    .title-small { font-family: 'Orbitron', sans-serif; font-size: 10px; color: #00ffff; letter-spacing: 2px; margin-bottom: 5px; opacity: 0.8; }
    .stat-value { font-family: 'Orbitron', sans-serif; font-size: 24px; font-weight: 700; }
    .planet-title { font-family: 'Orbitron', sans-serif; font-size: 32px; font-weight: 700; color: #ff0055; text-shadow: 0 0 10px rgba(255, 0, 85, 0.4); margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; }
    .desc-text { font-size: 13px; line-height: 1.4; color: #aaa; margin-top: 8px; white-space: pre-wrap; padding-top: 8px;}
    
    .data-row { display: flex; justify-content: space-between; margin-top: 15px; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 5px; }
    .data-label { color: #888; font-size: 12px; letter-spacing: 1px; }
    .data-val { font-family: 'Orbitron'; color: white; font-size: 14px; }

    /* Inputs & Buttons */
    input[type=range] { -webkit-appearance: none; width: 100%; background: transparent; margin: 10px 0; }
    input[type=range]:focus { outline: none; }
    input[type=range]::-webkit-slider-runnable-track { width: 100%; height: 2px; cursor: pointer; background: rgba(255,255,255,0.2); }
    input[type=range]::-webkit-slider-thumb { height: 14px; width: 14px; border-radius: 50%; background: #00ffff; cursor: pointer; -webkit-appearance: none; margin-top: -6px; box-shadow: 0 0 10px #00ffff; }
    
    .btn-control {
      background: transparent; border: 1px solid rgba(255,255,255,0.3); color: white;
      width: 40px; height: 40px; border-radius: 50%; cursor: pointer;
      display: flex; align-items: center; justify-content: center; font-size: 14px; transition: all 0.2s; flex-shrink: 0;
    }
    .btn-control:hover { background: rgba(255,255,255,0.1); border-color: white; }
    .btn-active { background: #00ffff; color: black; border-color: #00ffff; box-shadow: 0 0 15px rgba(0,255,255,0.4); }
    .btn-reset { width: auto; padding: 0 15px; border-radius: 20px; font-size: 10px; font-family: 'Orbitron'; letter-spacing: 1px; }
    .btn-danger {
      background: linear-gradient(90deg, #aa0000, #ff0000); border: none; color: white;
      padding: 0 25px; height: 40px; border-radius: 20px; font-family: 'Orbitron', sans-serif;
      font-weight: bold; cursor: pointer; letter-spacing: 1px; box-shadow: 0 0 10px rgba(255, 0, 0, 0.4); transition: transform 0.1s; white-space: nowrap;
    }
    .btn-danger:active { transform: scale(0.95); }
    
    .planet-label {
      color: #00ffff; font-family: 'Orbitron'; font-size: 10px; text-shadow: 0 0 5px black;
      padding: 4px 8px; background: rgba(0,0,0,0.7); border: 1px solid #00ffff; border-radius: 4px; transform: translateY(-20px);
    }
    .control-group { display: flex; flex-direction: column; gap: 5px; min-width: 120px; }
    .label-control { font-size: 10px; color: #888; letter-spacing: 1px; }

    /* --- MOBILE & RESPONSIVE TWEAKS --- */
    @media (max-width: 768px) {
      /* Top Left HUD */
      .hud-panel.top-left {
        top: 10px !important; left: 10px !important; width: auto !important; right: 10px;
        padding: 15px;
      }
      .hud-panel.top-left .desc-text { display: none; } /* Hide detailed text on mobile to save space */
      
      /* Instructions */
      .instructions { display: none; }

      /* Planet Panel (Becomes Bottom Sheet) */
      .planet-panel {
        width: 100% !important; height: 50vh;
        right: 0; left: 0; top: auto; bottom: 0;
        border-right: none; border-top: 3px solid #ff0055;
        transform: translateY(110%);
        border-radius: 20px 20px 0 0;
      }
      .planet-panel.active { transform: translateY(0); }

      /* Bottom Controls */
      .controls-container {
        width: 95%; bottom: 20px;
      }
      .controls-inner {
        flex-wrap: wrap; justify-content: center; gap: 15px; padding: 15px;
        background: rgba(10, 10, 15, 0.9);
      }
      .control-group { min-width: 40%; flex: 1; }
      .btn-danger { padding: 0 15px; font-size: 12px; }
      .btn-reset { display: none; } /* Hide reset on small screens if crowded */
    }
  `}</style>
)

// --- MAIN APP ---
export default function App() {
  const [mass, setMass] = useState(1);
  const [age, setAge] = useState(0);
  const [exploded, setExploded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const [focusTarget, setFocusTarget] = useState(null);
  const [selectedPlanet, setSelectedPlanet] = useState(null); // NEW: Track selected planet data
  const [resetKey, setResetKey] = useState(0); 
  
  const controlsRef = useRef();
  const starStats = useStarPhysics(mass, age);

  useEffect(() => {
    let interval;
    if (isPlaying && age < 15) {
      interval = setInterval(() => {
        setAge(prev => { if (prev >= 14.9) { setIsPlaying(false); return 15; } return prev + 0.05; });
      }, 50);
    }
    return () => clearInterval(interval);
  }, [isPlaying, age]);

  const triggerDeath = () => { setExploded(true); setTimeout(() => setExploded(false), 2000); };
  const toggleTime = () => setIsPlaying(!isPlaying);
  
  const reset = () => { 
      setIsPlaying(false); 
      setAge(0); 
      setExploded(false); 
      setFocusTarget(null); 
      setSelectedPlanet(null);
      controlsRef.current?.reset(); 
      setResetKey(prev => prev + 1);
  };

  const handleBackgroundClick = (e) => {
    setFocusTarget(null);
    setSelectedPlanet(null);
    controlsRef.current?.reset();
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'black', position: 'relative' }}>
      <UIStyles />
      <div style={{ position: 'absolute', zIndex: 10, width: '100%', height: '100%', pointerEvents: 'none' }}>
        
        {/* INFO PANEL (LEFT) */}
        <div className="hud-panel" style={{ position: 'absolute', top: 30, left: 30, width: 280 }}>
          <div className="title-small">SYSTEM STATUS // v3.0</div>
          <div className="stat-value" style={{ color: starStats.color, textShadow: `0 0 15px ${starStats.color}` }}>
            {starStats.stage}
          </div>
          <div className="desc-text" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>{starStats.description}</div>
        </div>

        {/* INSTRUCTIONS (RIGHT) - Hidden when planet is selected */}
        <div style={{ position: 'absolute', top: 30, right: 30, textAlign: 'right', opacity: selectedPlanet ? 0 : 0.6, transition: 'opacity 0.5s' }}>
          <div className="title-small" style={{ color: 'white' }}>INSTRUCTIONS</div>
          <div style={{ fontSize: '12px', color: '#ccc' }}>Click Planet to Focus<br/>Click Background to Reset View</div>
        </div>

        {/* PLANET DETAILS SLIDE-OUT PANEL (RIGHT) */}
        <div className={`planet-panel ${selectedPlanet ? 'active' : ''}`}>
             {selectedPlanet && (
                 <>
                    <div className="title-small">PLANETARY DATABASE</div>
                    <div className="planet-title">{selectedPlanet.name}</div>
                    <div className="desc-text">{selectedPlanet.desc}</div>
                    
                    <div style={{ marginTop: '30px' }}>
                        <div className="data-row">
                            <span className="data-label">REAL DIAMETER</span>
                            <span className="data-val">{selectedPlanet.realDiameter}</span>
                        </div>
                        <div className="data-row">
                            <span className="data-label">AVG TEMP</span>
                            <span className="data-val">{selectedPlanet.temp}</span>
                        </div>
                        <div className="data-row">
                            <span className="data-label">DAY LENGTH</span>
                            <span className="data-val">{selectedPlanet.day}</span>
                        </div>
                        <div className="data-row">
                            <span className="data-label">MOONS</span>
                            <span className="data-val">{selectedPlanet.hasMoon ? '1 (Mapped)' : '0'}</span>
                        </div>
                    </div>
                 </>
             )}
        </div>

        {/* CONTROLS (BOTTOM) */}
        <div style={{ position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '20px', alignItems: 'flex-end', pointerEvents: 'auto' }}>
          <div className="hud-panel" style={{ display: 'flex', gap: '30px', padding: '15px 30px', borderRadius: '40px', alignItems: 'center' }}>
            
            <div className="control-group">
              <div className="label-control">STAR MASS (M☉)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input type="range" min="0.5" max="15" step="0.1" value={mass} onChange={e => setMass(Number(e.target.value))} disabled={isPlaying} />
                <span style={{ fontFamily: 'Orbitron', width: '30px' }}>{mass}</span>
              </div>
            </div>

            <div className="control-group">
              <div className="label-control">TIMELINE (BY)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input type="range" min="0" max="15" step="0.1" value={age} onChange={e => setAge(Number(e.target.value))} />
                <span style={{ fontFamily: 'Orbitron', width: '35px' }}>{age.toFixed(1)}</span>
              </div>
            </div>

            <div style={{ height: '30px', width: '1px', background: 'rgba(255,255,255,0.2)' }}></div>
            
            <button className={`btn-control ${isPlaying ? 'btn-active' : ''}`} onClick={toggleTime} title="Play/Pause">
              {isPlaying ? '⏸' : '▶'}
            </button>
            <button className="btn-control btn-reset" onClick={reset} title="Reset Solar System">RESET</button>
            <button className="btn-danger" onClick={triggerDeath}>DETONATE</button>

          </div>
        </div>
      </div>

      <Canvas shadows camera={{ position: [0, 25, 40], fov: 45 }} onPointerMissed={handleBackgroundClick}> 
        <OrbitControls ref={controlsRef} minDistance={5} maxDistance={150} />
        <ambientLight intensity={0.05} />
        <Suspense fallback={null}>
          <StarField />
          <Star settings={starStats} exploded={exploded} setFocus={setFocusTarget} setSelectPlanet={setSelectedPlanet} />
          
          <group key={resetKey}>
             {/* PLANETS - Now receiving setSelectPlanet */}
             <PlanetarySystem 
                starScale={starStats.scale} 
                exploded={exploded} 
                mass={mass} 
                starAge={age} 
                setFocus={setFocusTarget} 
                setSelectPlanet={setSelectedPlanet}
             />
             
             {/* INNER ASTEROID BELT */}
             <AsteroidBelt mass={mass} age={age} exploded={exploded} starScale={starStats.scale} />

             {/* OUTER KUIPER BELT */}
             <KuiperBelt mass={mass} age={age} exploded={exploded} starScale={starStats.scale} />
          </group>
        
        </Suspense>
        <CameraRig focusRef={focusTarget} controlsRef={controlsRef} />
        <Shockwave exploded={exploded} />
        <CameraShake maxYaw={exploded ? 0.1 : 0} maxPitch={exploded ? 0.1 : 0} maxRoll={exploded ? 0.1 : 0} yawFrequency={exploded ? 10 : 0} intensity={1} decayRate={0.65} />
        <EffectComposer>
          <Bloom luminanceThreshold={0} luminanceSmoothing={0.9} height={300} intensity={1.5} />
        </EffectComposer>
      </Canvas>
    </div>
  )
}
