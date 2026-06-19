// tweaks-app.jsx — wires the Tweaks panel to the vanilla dashboard via :root attributes.
const { useEffect } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "Crimson",
  "surface": "Carbon",
  "density": "Regular",
  "glow": true
}/*EDITMODE-END*/;

const ACCENT_SWATCH = { Crimson: "#ff2b3d", Blood: "#d10f1c", Signal: "#ff3a2e" };

function TweaksApp() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  useEffect(() => {
    const r = document.documentElement;
    r.setAttribute("data-accent", (t.accent || "Crimson").toLowerCase());
    r.setAttribute("data-surface", (t.surface || "Carbon").toLowerCase());
    r.setAttribute("data-density", (t.density || "Regular").toLowerCase());
    r.setAttribute("data-glow", t.glow ? "on" : "off");
    if (window.__cyberRefreshTheme) window.__cyberRefreshTheme();
  }, [t.accent, t.surface, t.density, t.glow]);

  return (
    <TweaksPanel title="Tweaks">
      <TweakSection label="Accent" />
      <TweakColor label="Crimson tone" value={ACCENT_SWATCH[t.accent] || "#ff2b3d"}
        options={["#ff2b3d", "#d10f1c", "#ff3a2e"]}
        onChange={(hex) => {
          const name = Object.keys(ACCENT_SWATCH).find((k) => ACCENT_SWATCH[k] === hex) || "Crimson";
          setTweak("accent", name);
        }} />
      <TweakToggle label="Accent glow" value={t.glow} onChange={(v) => setTweak("glow", v)} />

      <TweakSection label="Surface" />
      <TweakRadio label="Panel finish" value={t.surface}
        options={["Matte", "Carbon", "Glass"]}
        onChange={(v) => setTweak("surface", v)} />

      <TweakSection label="Layout" />
      <TweakRadio label="Density" value={t.density}
        options={["Compact", "Regular", "Comfy"]}
        onChange={(v) => setTweak("density", v)} />
    </TweaksPanel>
  );
}

const mount = document.createElement("div");
document.body.appendChild(mount);
ReactDOM.createRoot(mount).render(<TweaksApp />);
