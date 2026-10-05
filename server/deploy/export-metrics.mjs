const token = process.env.METRICS_EXPORT_TOKEN;
if (!token) throw new Error('METRICS_EXPORT_TOKEN is not configured');
const response = await fetch('http://127.0.0.1:8080/api/metrics/export', {
  headers: {Authorization: `Bearer ${token}`},
  signal: AbortSignal.timeout(15_000),
});
if (!response.ok) throw new Error(`Metrics export failed: HTTP ${response.status}`);
process.stdout.write(`${JSON.stringify(await response.json(), null, 2)}\n`);
