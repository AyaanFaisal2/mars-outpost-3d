// Real Mars numbers the game uses. Each one carries its source so the game and docs can cite it.
const FACTS = 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html';
export const MARS = {
  surfaceDose: { value: 0.64, unit: 'mSv per sol', source: 'Curiosity RAD on the surface (Hassler et al., Science 2014)', url: 'https://doi.org/10.1126/science.1244797' },
  cruiseDose: { value: 1.84, unit: 'mSv per day', source: 'Curiosity RAD during the flight to Mars (Zeitlin et al., Science 2013)', url: 'https://doi.org/10.1126/science.1235989' },
  cruiseDays: { value: 180, unit: 'days', source: 'One-way crewed transit used by Zeitlin et al. 2013', url: 'https://doi.org/10.1126/science.1235989' },
  careerLimit: { value: 600, unit: 'mSv', source: 'NASA-STD-3001 career radiation limit (NASA OCHMO technical brief)', url: 'https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf' },
  solHours: { value: 24.6597, unit: 'hours', source: 'NASA Mars Fact Sheet (length of day)', url: FACTS },
  sunlight: { value: 0.431, unit: "× Earth's", source: 'NASA Mars Fact Sheet (solar irradiance 586 vs 1361 W/m²)', url: FACTS },
  lightMin: { value: [3.0, 22.3], unit: 'minutes one way', source: 'NASA Mars Fact Sheet (Earth distance 54.6–401.4 million km ÷ speed of light)', url: FACTS },
  avgTemp: { value: -59, unit: '°C', source: 'NASA Mars Fact Sheet (average temperature ~214 K)', url: FACTS },
  storm2017: { value: [2, 3], unit: '× normal dose rate', source: 'Curiosity RAD, Sept 2017 storm (Zeitlin et al., GRL 2018; NASA/SwRI release)', url: 'https://www.swri.org/newsroom/press-releases/large-solar-storm-sparks-global-aurora-doubles-radiation-levels-mars' },
  site: { value: 'Jezero Crater, about 18.4°N 77.5°E', unit: '', source: 'NASA Perseverance mission', url: 'https://science.nasa.gov/mission/mars-2020-perseverance/' },
};
