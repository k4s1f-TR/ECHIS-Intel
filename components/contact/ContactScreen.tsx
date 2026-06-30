"use client";

import { useState, type CSSProperties } from "react";

// Faithful React port of the design-handoff `echis-contact` screen.
// Layout, colours, typography and the send → confirmation logic mirror the
// original bundled markup 1:1; the only adaptation is mapping the design's
// literal font families onto the app's loaded next/font variables.
const FONT_SANS = "var(--font-ui), 'Hanken Grotesk', system-ui, sans-serif";
const FONT_MONO = "var(--font-mono), 'JetBrains Mono', monospace";
const FONT_SERIF = "var(--font-spectral), 'Spectral', Georgia, serif";

const inputBase: CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,.03)",
  border: "1px solid rgba(255,255,255,.09)",
  borderRadius: "7px",
  padding: "11px 13px",
  color: "#ededf0",
  fontFamily: FONT_SANS,
  fontSize: "14px",
  outline: "none",
};

const labelStyle: CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: "10px",
  letterSpacing: "1.6px",
  color: "#76767e",
  textTransform: "uppercase",
  marginBottom: "7px",
};

function applyFocus(el: HTMLElement) {
  el.style.borderColor = "rgba(232,52,74,.6)";
  el.style.boxShadow = "0 0 0 3px rgba(232,52,74,.12)";
}

function clearFocus(el: HTMLElement) {
  el.style.borderColor = "rgba(255,255,255,.09)";
  el.style.boxShadow = "none";
}

function DirectChannel({
  icon,
  handle,
  meta,
}: {
  icon: React.ReactNode;
  handle: string;
  meta: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "11px 0",
        cursor: "pointer",
        color: "#c6c6cc",
        transition: "color 120ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = "#e8344a";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "#c6c6cc";
      }}
    >
      {icon}
      <span style={{ fontSize: "14px" }}>{handle}</span>
      <span style={{ marginLeft: "auto", color: "#5a5a62", fontSize: "12px" }}>
        {meta}
      </span>
    </div>
  );
}

export function ContactScreen() {
  const [sent, setSent] = useState(false);
  const [id, setId] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setId("ECH-" + Math.floor(1000 + Math.random() * 9000));
    setSent(true);
  }

  function reset() {
    setSent(false);
  }

  return (
    <div
      className="echis-contact-root"
      style={{
        width: "100%",
        height: "100%",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        padding: "34px 44px",
        background: "#050506",
        color: "#c6c6cc",
        fontFamily: FONT_SANS,
      }}
    >
      <style>{`
        .echis-contact-root input::placeholder,
        .echis-contact-root textarea::placeholder { color: #5a5a62; }
        .echis-contact-root textarea { resize: none; }
        .echis-contact-root select option { background: #0c0c0e; color: #ededf0; }
      `}</style>

      {/* Header strip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: "13px" }}>
          <span
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: "#e8344a",
              display: "inline-block",
            }}
          />
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: "13px",
              letterSpacing: "2.5px",
              color: "#e8344a",
              fontWeight: 600,
            }}
          >
            CONTACT
          </span>
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: "10.5px",
              letterSpacing: "2px",
              color: "#76767e",
            }}
          >
            CHANNEL · SITE OPERATIONS
          </span>
        </div>
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: "10px",
            letterSpacing: "1.6px",
            color: "#76767e",
            border: "1px solid rgba(255,255,255,.1)",
            borderRadius: "20px",
            padding: "5px 12px",
          }}
        >
          SECURE INTAKE · ≤ 48H
        </span>
      </div>

      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,.06)",
          margin: "22px 0 30px",
        }}
      />

      <div style={{ display: "flex", gap: "58px", flex: 1, minHeight: 0 }}>
        {/* Left column */}
        <div
          style={{
            width: "430px",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              fontFamily: FONT_SERIF,
              fontSize: "42px",
              lineHeight: 1.08,
              color: "#ededf0",
              fontWeight: 500,
            }}
          >
            Reach site operations directly.
          </div>
          <div
            style={{
              fontFamily: FONT_SERIF,
              fontStyle: "italic",
              color: "#9a9aa2",
              fontSize: "17px",
              marginTop: "18px",
              lineHeight: 1.5,
            }}
          >
            Questions, corrections, partnerships or data requests — every
            message lands on the desk.
          </div>

          <div
            style={{
              marginTop: "34px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {[
              { label: "Response time", value: "Within 24–48 hours", last: false },
              { label: "Channel", value: "Secure intake relay", last: false },
              {
                label: "Hours",
                value: "Mon–Fri · 09:00–18:00 (UTC+3)",
                last: true,
              },
            ].map((row) => (
              <div
                key={row.label}
                style={{
                  display: "flex",
                  padding: "13px 0",
                  borderTop: "1px solid rgba(255,255,255,.06)",
                  borderBottom: row.last
                    ? "1px solid rgba(255,255,255,.06)"
                    : undefined,
                }}
              >
                <span
                  style={{
                    width: "150px",
                    flexShrink: 0,
                    fontFamily: FONT_MONO,
                    fontSize: "10px",
                    letterSpacing: "1.5px",
                    color: "#76767e",
                    textTransform: "uppercase",
                  }}
                >
                  {row.label}
                </span>
                <span style={{ fontSize: "14px", color: "#ededf0" }}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: "auto", paddingTop: "28px" }}>
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: "10px",
                letterSpacing: "1.8px",
                color: "#76767e",
                textTransform: "uppercase",
                marginBottom: "6px",
              }}
            >
              Direct channels
            </div>
            <DirectChannel
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22 3 2 10.6l5.7 1.9L18 6l-7.6 8.4.1 5 3-3.4 4.6 3.4L22 3Z" />
                </svg>
              }
              handle="@echis_desk"
              meta="Telegram ↗"
            />
            <DirectChannel
              icon={
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M4 4l16 16M20 4 4 20" />
                </svg>
              }
              handle="@echis_osint"
              meta="X ↗"
            />
            <DirectChannel
              icon={
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                >
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="m3 7 9 6 9-6" />
                </svg>
              }
              handle="contact@echis.io"
              meta="Email ↗"
            />
          </div>
        </div>

        {/* Right column — form / confirmation */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            background: "rgba(255,255,255,.018)",
            border: "1px solid rgba(255,255,255,.07)",
            borderRadius: "12px",
            padding: "30px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          {!sent ? (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "22px",
                }}
              >
                <span
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: "11px",
                    letterSpacing: "2px",
                    color: "#c6c6cc",
                  }}
                >
                  SEND A MESSAGE
                </span>
                <span
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: "10px",
                    letterSpacing: "1px",
                    color: "#5a5a62",
                  }}
                >
                  ALL FIELDS REQUIRED
                </span>
              </div>

              <form
                onSubmit={submit}
                style={{ display: "flex", flexDirection: "column", gap: "17px" }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "16px",
                  }}
                >
                  <div>
                    <div style={labelStyle}>Full name</div>
                    <input
                      type="text"
                      required
                      placeholder="Your name"
                      style={inputBase}
                      onFocus={(e) => applyFocus(e.currentTarget)}
                      onBlur={(e) => clearFocus(e.currentTarget)}
                    />
                  </div>
                  <div>
                    <div style={labelStyle}>Email</div>
                    <input
                      type="email"
                      required
                      placeholder="you@domain.com"
                      style={inputBase}
                      onFocus={(e) => applyFocus(e.currentTarget)}
                      onBlur={(e) => clearFocus(e.currentTarget)}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.4fr 1fr",
                    gap: "16px",
                  }}
                >
                  <div>
                    <div style={labelStyle}>Subject</div>
                    <input
                      type="text"
                      required
                      placeholder="Brief subject line"
                      style={inputBase}
                      onFocus={(e) => applyFocus(e.currentTarget)}
                      onBlur={(e) => clearFocus(e.currentTarget)}
                    />
                  </div>
                  <div>
                    <div style={labelStyle}>Category</div>
                    <div style={{ position: "relative" }}>
                      <select
                        style={{
                          ...inputBase,
                          appearance: "none",
                          colorScheme: "dark",
                          cursor: "pointer",
                        }}
                        onFocus={(e) => applyFocus(e.currentTarget)}
                        onBlur={(e) => clearFocus(e.currentTarget)}
                      >
                        <option>General enquiry</option>
                        <option>Correction / bug</option>
                        <option>Partnership</option>
                        <option>Data request</option>
                        <option>Press</option>
                      </select>
                      <span
                        style={{
                          position: "absolute",
                          right: "13px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "#76767e",
                          pointerEvents: "none",
                          fontSize: "10px",
                        }}
                      >
                        ▼
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <div style={labelStyle}>Message</div>
                  <textarea
                    required
                    rows={4}
                    placeholder="Tell us what you need — include links and context where you can."
                    style={{ ...inputBase, lineHeight: 1.5 }}
                    onFocus={(e) => applyFocus(e.currentTarget)}
                    onBlur={(e) => clearFocus(e.currentTarget)}
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginTop: "2px",
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "7px",
                      color: "#76767e",
                      fontSize: "12px",
                    }}
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <rect x="5" y="11" width="14" height="9" rx="2" />
                      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                    </svg>
                    Sent over a secure relay
                  </span>
                  <button
                    type="submit"
                    style={{
                      background: "#e8344a",
                      color: "#fff",
                      border: "none",
                      borderRadius: "7px",
                      padding: "12px 22px",
                      fontFamily: FONT_SANS,
                      fontSize: "13.5px",
                      fontWeight: 600,
                      letterSpacing: ".2px",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      transition: "background 120ms ease, box-shadow 120ms ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#ff4257";
                      e.currentTarget.style.boxShadow =
                        "0 6px 22px rgba(232,52,74,.35)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#e8344a";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    Send message <span style={{ fontSize: "15px" }}>→</span>
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                padding: "24px 10px",
              }}
            >
              <div
                style={{
                  width: "58px",
                  height: "58px",
                  borderRadius: "50%",
                  border: "1px solid rgba(232,52,74,.5)",
                  background: "rgba(232,52,74,.10)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#e8344a",
                  boxShadow: "0 0 26px rgba(232,52,74,.25)",
                  marginBottom: "20px",
                }}
              >
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="m5 13 4 4L19 7" />
                </svg>
              </div>
              <div
                style={{
                  fontFamily: FONT_SERIF,
                  fontSize: "27px",
                  color: "#ededf0",
                  marginBottom: "11px",
                }}
              >
                Message transmitted.
              </div>
              <div
                style={{
                  color: "#9a9aa2",
                  fontSize: "14px",
                  marginBottom: "7px",
                }}
              >
                Logged as{" "}
                <span
                  style={{
                    fontFamily: FONT_MONO,
                    color: "#e8344a",
                    border: "1px solid rgba(232,52,74,.4)",
                    borderRadius: "5px",
                    padding: "2px 8px",
                    fontSize: "12.5px",
                  }}
                >
                  {id}
                </span>
              </div>
              <div
                style={{
                  color: "#76767e",
                  fontSize: "13.5px",
                  marginBottom: "22px",
                }}
              >
                We&apos;ll reply within 24–48 hours.
              </div>
              <span
                onClick={reset}
                style={{
                  color: "#c6c6cc",
                  fontSize: "13px",
                  cursor: "pointer",
                  borderBottom: "1px solid rgba(255,255,255,.2)",
                  paddingBottom: "2px",
                  transition: "color 120ms ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#e8344a";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#c6c6cc";
                }}
              >
                Send another message
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
