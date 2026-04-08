const DEFAULT_HOST = "magicgarden.gg";

async function fetchVersion(host = DEFAULT_HOST) {
  const res = await fetch(`https://${host}/platform/v1/version`);
  if (!res.ok) throw new Error(`Version fetch failed: ${res.status}`);
  const data = await res.json();
  if (!data.version) throw new Error("No version field in response");
  return data.version;
}

module.exports = { fetchVersion };
