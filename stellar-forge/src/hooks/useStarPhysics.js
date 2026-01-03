import { useMemo } from 'react';

export function useStarPhysics(mass, age) {
  return useMemo(() => {
    // 1. Calculate Lifespan (Bigger stars live shorter lives)
    const lifespan = 10 / (mass * mass); // Simplified physics
    const progress = age / lifespan; // 0.0 = Birth, 1.0 = Death

    let color = '#ffaa00'; // Default Sun Yellow
    let scale = mass;      // Base size
    let stage = 'Main Sequence';
    let description = 'Stable burning of hydrogen.';

    // --- LOGIC TREE ---

    // STAGE 1: BIRTH (0% - 10%)
    if (progress < 0.1) {
      color = '#ffffff'; // Hot White/Blue
      scale = mass * 0.5; // Small and contracting
      stage = 'Proto-Star';
      description = 'A gas cloud collapsing under gravity.';
    } 
    // STAGE 2: MAIN SEQUENCE (10% - 90%)
    else if (progress < 0.9) {
      if (mass < 0.8) {
        color = '#ff5555'; // Red Dwarf
        stage = 'Red Dwarf';
        description = 'Burning slowly. Will live essentially forever.';
      } else if (mass > 8) {
        color = '#5588ff'; // Blue Giant
        scale = mass * 1.5;
        stage = 'Blue Supergiant';
        description = 'Burning fuel rapidly. Violent death imminent.';
      } else {
        color = '#ffaa00'; // Sun-like
        stage = 'Main Sequence';
        description = 'Stable life. Capable of supporting liquid water.';
      }
    }
    // STAGE 3: DYING (90%+)
    else {
      // Small/Medium stars swell into Red Giants
      if (mass <= 8) {
        color = '#ff0000'; // Deep Red
        scale = mass * 4;  // Huge expansion
        stage = 'Red Giant';
        description = 'Expanding. Consuming inner planets.';
      } 
      // Massive stars collapse (Supernova prep)
      else {
        color = '#8800ff'; // Instability Purple
        scale = mass * 0.8; // Shrinking before boom
        stage = 'Wolf-Rayet';
        description = 'Core collapse imminent. Supernova incoming.';
      }
    }

    return { color, scale, stage, description, progress };
  }, [mass, age]);
}