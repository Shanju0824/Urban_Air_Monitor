const pollutantLabels = {
  aqi: "AQI",
  pm25: "PM2.5",
  pm10: "PM10",
  no2: "NO2",
  so2: "SO2"
};

export function getAqiBand(aqi) {
  if (aqi <= 50) return { label: "Good", color: "#2f9e44" };
  if (aqi <= 100) return { label: "Satisfactory", color: "#74b816" };
  if (aqi <= 200) return { label: "Moderate", color: "#f08c00" };
  if (aqi <= 300) return { label: "Poor", color: "#e8590c" };
  if (aqi <= 400) return { label: "Very Poor", color: "#c92a2a" };
  return { label: "Severe", color: "#862e9c" };
}

export function latestReading(station) {
  return [...station.readings].sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt))[0];
}

export function buildDashboard(stations, policyActions) {
  const stationSummaries = stations.map((station) => {
    const latest = latestReading(station);
    const previous = [...station.readings].sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt))[1] || latest;
    const band = getAqiBand(latest.aqi);

    return {
      id: String(station._id || station.name),
      name: station.name,
      zone: station.zone,
      coordinates: station.coordinates,
      latest,
      band,
      aqiChange: latest.aqi - previous.aqi
    };
  });

  const averageAqi = Math.round(
    stationSummaries.reduce((sum, station) => sum + station.latest.aqi, 0) / stationSummaries.length
  );
  const highestRisk = [...stationSummaries].sort((a, b) => b.latest.aqi - a.latest.aqi)[0];
  const alerts = stationSummaries
    .filter((station) => station.latest.aqi > 150 || station.latest.pm25 > 60 || station.latest.pm10 > 100)
    .map((station) => ({
      station: station.name,
      zone: station.zone,
      severity: station.latest.aqi > 200 ? "Critical" : "Watch",
      message: `${station.band.label} air quality with AQI ${station.latest.aqi}`
    }));

  const trends = stations[0].readings.map((reading) => {
    const date = reading.recordedAt;
    const matchingReadings = stations.map((station) =>
      station.readings.find((entry) => String(entry.recordedAt) === String(date))
    );

    return {
      date,
      aqi: Math.round(matchingReadings.reduce((sum, entry) => sum + entry.aqi, 0) / matchingReadings.length),
      pm25: Math.round(matchingReadings.reduce((sum, entry) => sum + entry.pm25, 0) / matchingReadings.length),
      pm10: Math.round(matchingReadings.reduce((sum, entry) => sum + entry.pm10, 0) / matchingReadings.length),
      no2: Math.round(matchingReadings.reduce((sum, entry) => sum + entry.no2, 0) / matchingReadings.length),
      so2: Math.round(matchingReadings.reduce((sum, entry) => sum + entry.so2, 0) / matchingReadings.length)
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      monitoredStations: stations.length,
      averageAqi,
      highestRiskStation: highestRisk.name,
      activeAlerts: alerts.length,
      publicHealthStatus: getAqiBand(averageAqi).label
    },
    pollutantLabels,
    stations: stationSummaries,
    trends,
    alerts,
    policyActions
  };
}
