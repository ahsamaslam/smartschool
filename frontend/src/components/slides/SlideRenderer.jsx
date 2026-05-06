/**
 * Single-slide canvas renderer — layout + premium template CSS.
 */

function BulletRemove({ editing, onRemove }) {
  if (!editing) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onRemove();
      }}
      title="Remove line"
      style={{
        flexShrink: 0,
        marginTop: "2px",
        width: "22px",
        height: "22px",
        borderRadius: "6px",
        border: "none",
        background: "rgba(239,68,68,0.12)",
        color: "#b91c1c",
        cursor: "pointer",
        fontSize: "14px",
        lineHeight: 1,
      }}
    >
      ×
    </button>
  );
}

export function SlideRenderer({
  slide,
  template,
  editing = false,
  onUpdateTitle,
  onUpdateContent,
  slideIndex = 0,
  scale = 1,
}) {
  const css = template.css;
  const isSplit = css.splitLeft;
  const alternate = Boolean(css.alternateSplit && slideIndex % 2 === 1);
  const isGlass = css.glassCard;
  const useCards = css.useCards;

  const containerStyle = {
    width: "100%",
    height: "100%",
    background: css.slideBackground,
    fontFamily: css.bodyFont,
    position: "relative",
    overflow: "hidden",
    boxSizing: "border-box",
    transform: scale !== 1 ? `scale(${scale})` : undefined,
    transformOrigin: scale !== 1 ? "top left" : undefined,
  };

  const titleStyle = {
    fontFamily: css.titleFont,
    fontSize: css.titleSize,
    fontWeight: css.titleWeight,
    color: css.titleColor,
    letterSpacing: css.titleLetterSpacing || "normal",
    lineHeight: 1.2,
    margin: 0,
    padding: 0,
  };

  const bodyStyle = {
    fontFamily: css.bodyFont,
    fontSize: css.bodySize,
    color: css.bodyColor,
    lineHeight: css.lineHeight,
  };

  const accentBar = (
    <div
      style={{
        width: "48px",
        height: "3px",
        background: css.accentColor,
        borderRadius: "2px",
        marginBottom: "16px",
        flexShrink: 0,
      }}
    />
  );

  if (isSplit) {
    return (
      <div style={containerStyle}>
        <div
          style={{
            display: "flex",
            flexDirection: alternate ? "row-reverse" : "row",
            height: "100%",
            width: "100%",
          }}
        >
          <div
            style={{
              width: "38%",
              background: css.splitBg,
              padding: "48px 36px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                background: "rgba(255,255,255,0.25)",
                marginBottom: "20px",
              }}
            />
            {editing ? (
              <textarea
                value={slide.title}
                onChange={(e) => onUpdateTitle?.(e.target.value)}
                style={{
                  ...titleStyle,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  resize: "none",
                  width: "100%",
                  padding: 0,
                }}
                rows={3}
              />
            ) : (
              <h2 style={titleStyle}>{slide.title}</h2>
            )}
          </div>
          <div
            style={{
              flex: 1,
              padding: "40px 36px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              background: "#ffffff",
            }}
          >
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
              {(slide.content || []).map((item, i) => (
                <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px", width: "100%" }}>
                  <span style={{ color: css.accentColor, fontWeight: 700, flexShrink: 0, marginTop: "2px" }}>{css.bulletChar}</span>
                  {editing ? (
                    <input
                      value={item}
                      onChange={(e) => onUpdateContent?.(i, e.target.value)}
                      style={{
                        ...bodyStyle,
                        border: "none",
                        outline: "none",
                        background: "transparent",
                        flex: 1,
                        minWidth: 0,
                        padding: 0,
                        color: "#1e1b4b",
                      }}
                    />
                  ) : (
                    <span style={{ ...bodyStyle, color: "#1e1b4b" }}>{item}</span>
                  )}
                  <BulletRemove editing={editing} onRemove={() => onUpdateContent?.(i, null)} />
                </li>
              ))}
            </ul>
            {editing && (
              <button
                type="button"
                onClick={() => onUpdateContent?.(slide.content.length, "")}
                style={{
                  marginTop: "12px",
                  color: css.accentColor,
                  fontSize: "12px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                + Add item
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (slide.layout === "title-only") {
    return (
      <div style={{ ...containerStyle, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: css.padding, maxWidth: "85%" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
            <div style={{ width: "48px", height: "4px", background: css.accentColor, borderRadius: "2px" }} />
          </div>
          {editing ? (
            <textarea
              value={slide.title}
              onChange={(e) => onUpdateTitle?.(e.target.value)}
              style={{
                ...titleStyle,
                background: "transparent",
                border: "none",
                outline: "none",
                resize: "none",
                textAlign: "center",
                width: "100%",
                padding: 0,
              }}
              rows={3}
            />
          ) : (
            <h1 style={{ ...titleStyle, fontSize: `calc(${css.titleSize} * 1.1)` }}>{slide.title}</h1>
          )}
          {editing ? (
            <textarea
              value={slide.content?.[0] || ""}
              onChange={(e) => onUpdateContent?.(0, e.target.value)}
              placeholder="Optional subtitle or session note"
              style={{
                ...bodyStyle,
                marginTop: "20px",
                opacity: 0.9,
                width: "100%",
                background: "rgba(0,0,0,0.03)",
                border: "none",
                borderRadius: "8px",
                padding: "8px",
                resize: "none",
                outline: "none",
                textAlign: "center",
              }}
              rows={2}
            />
          ) : (
            slide.content?.[0] && <p style={{ ...bodyStyle, marginTop: "20px", opacity: 0.85 }}>{slide.content[0]}</p>
          )}
        </div>
      </div>
    );
  }

  if (slide.layout === "highlight") {
    const hBg = css.highlightBg || "rgba(255,255,255,0.1)";
    const hBorder = css.highlightBorder || "1px solid rgba(255,255,255,0.2)";
    return (
      <div style={{ ...containerStyle, padding: css.padding, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        {accentBar}
        {editing ? (
          <textarea
            value={slide.title}
            onChange={(e) => onUpdateTitle?.(e.target.value)}
            style={{
              ...titleStyle,
              background: "transparent",
              border: "none",
              outline: "none",
              resize: "none",
              width: "100%",
              padding: 0,
              marginBottom: "24px",
            }}
            rows={2}
          />
        ) : (
          <h2 style={{ ...titleStyle, marginBottom: "24px" }}>{slide.title}</h2>
        )}
        <div
          style={{
            background: hBg,
            border: hBorder,
            borderRadius: "16px",
            padding: "24px 28px",
            backdropFilter: isGlass ? css.glassBlur : undefined,
          }}
        >
          {editing ? (
            <textarea
              value={slide.content?.[0] || ""}
              onChange={(e) => onUpdateContent?.(0, e.target.value)}
              style={{
                ...bodyStyle,
                fontSize: "1.2em",
                fontWeight: 600,
                background: "transparent",
                border: "none",
                outline: "none",
                resize: "none",
                width: "100%",
                padding: 0,
              }}
              rows={4}
            />
          ) : (
            <p style={{ ...bodyStyle, fontSize: "1.2em", fontWeight: 600, margin: 0 }}>{slide.content?.[0]}</p>
          )}
        </div>
      </div>
    );
  }

  if (slide.layout === "quote") {
    return (
      <div style={{ ...containerStyle, display: "flex", alignItems: "center", justifyContent: "center", padding: css.padding }}>
        <div style={{ textAlign: "center", maxWidth: "80%" }}>
          <div
            style={{
              fontSize: "80px",
              lineHeight: 0.8,
              color: css.accentColor,
              opacity: 0.6,
              marginBottom: "24px",
              fontFamily: "Georgia, serif",
            }}
          >
            &ldquo;
          </div>
          {editing ? (
            <textarea
              value={slide.content?.[0] || ""}
              onChange={(e) => onUpdateContent?.(0, e.target.value)}
              style={{
                ...bodyStyle,
                fontSize: "1.4em",
                fontStyle: "italic",
                background: "transparent",
                border: "none",
                outline: "none",
                resize: "none",
                textAlign: "center",
                width: "100%",
                padding: 0,
              }}
              rows={4}
            />
          ) : (
            <p style={{ ...bodyStyle, fontSize: "1.4em", fontStyle: "italic", margin: "0 0 20px" }}>{slide.content?.[0]}</p>
          )}
          {slide.title && (
            <p
              style={{
                ...bodyStyle,
                color: css.accentColor,
                fontWeight: 700,
                fontSize: "0.9em",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              — {slide.title}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (slide.layout === "steps") {
    return (
      <div style={{ ...containerStyle, padding: css.padding }}>
        {accentBar}
        {editing ? (
          <textarea
            value={slide.title}
            onChange={(e) => onUpdateTitle?.(e.target.value)}
            style={{
              ...titleStyle,
              background: "transparent",
              border: "none",
              outline: "none",
              resize: "none",
              width: "100%",
              padding: 0,
              marginBottom: "24px",
            }}
            rows={2}
          />
        ) : (
          <h2 style={{ ...titleStyle, marginBottom: "24px" }}>{slide.title}</h2>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {(slide.content || []).map((item, i) => {
            const stepBg = useCards ? css.cardBg : isGlass ? css.glassBg : "transparent";
            const stepBorder = useCards ? `1px solid transparent` : isGlass ? css.glassBorder : "none";
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "14px",
                  background: stepBg,
                  border: stepBorder,
                  borderRadius: "10px",
                  padding: useCards ? css.cardPadding : "6px 0",
                  backdropFilter: isGlass ? css.glassBlur : undefined,
                  boxShadow: useCards ? css.cardShadow : "none",
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 800,
                    color: css.numberColor,
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: `${css.accentColor}20`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </span>
                {editing ? (
                  <>
                    <input
                      value={item}
                      onChange={(e) => onUpdateContent?.(i, e.target.value)}
                      style={{ ...bodyStyle, flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", padding: 0 }}
                    />
                    <BulletRemove editing={editing} onRemove={() => onUpdateContent?.(i, null)} />
                  </>
                ) : (
                  <span style={bodyStyle}>{item}</span>
                )}
              </div>
            );
          })}
        </div>
        {editing && (
          <button
            type="button"
            onClick={() => onUpdateContent?.(slide.content.length, "")}
            style={{ marginTop: "10px", color: css.accentColor, fontSize: "12px", background: "none", border: "none", cursor: "pointer" }}
          >
            + Add step
          </button>
        )}
      </div>
    );
  }

  if (slide.layout === "two-column") {
    const half = Math.ceil((slide.content || []).length / 2);
    const col1 = (slide.content || []).slice(0, half);
    const col2 = (slide.content || []).slice(half);
    return (
      <div style={{ ...containerStyle, padding: css.padding }}>
        {accentBar}
        {editing ? (
          <textarea
            value={slide.title}
            onChange={(e) => onUpdateTitle?.(e.target.value)}
            style={{
              ...titleStyle,
              background: "transparent",
              border: "none",
              outline: "none",
              resize: "none",
              width: "100%",
              padding: 0,
              marginBottom: "20px",
            }}
            rows={2}
          />
        ) : (
          <h2 style={{ ...titleStyle, marginBottom: "20px" }}>{slide.title}</h2>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", flex: 1 }}>
          {[col1, col2].map((col, ci) => (
            <div
              key={ci}
              style={{
                background: isGlass ? css.glassBg : useCards ? css.cardBg : "transparent",
                border: isGlass ? css.glassBorder : "none",
                borderRadius: isGlass || useCards ? "12px" : "0",
                padding: isGlass || useCards ? "16px 20px" : "0",
                backdropFilter: isGlass ? css.glassBlur : undefined,
                boxShadow: useCards ? css.cardShadow : "none",
              }}
            >
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                {col.map((item, i) => {
                  const realIdx = ci === 0 ? i : half + i;
                  return (
                    <li key={i} style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                      <span style={{ color: css.accentColor, flexShrink: 0 }}>{css.bulletChar}</span>
                      {editing ? (
                        <>
                          <input
                            value={item}
                            onChange={(e) => onUpdateContent?.(realIdx, e.target.value)}
                            style={{ ...bodyStyle, flex: 1, background: "transparent", border: "none", outline: "none", padding: 0 }}
                          />
                          <BulletRemove editing={editing} onRemove={() => onUpdateContent?.(realIdx, null)} />
                        </>
                      ) : (
                        <span style={bodyStyle}>{item}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...containerStyle, padding: css.padding }}>
      {accentBar}
      {editing ? (
        <textarea
          value={slide.title}
          onChange={(e) => onUpdateTitle?.(e.target.value)}
          style={{
            ...titleStyle,
            background: "transparent",
            border: "none",
            outline: "none",
            resize: "none",
            width: "100%",
            padding: 0,
            marginBottom: "20px",
          }}
          rows={2}
        />
      ) : (
        <h2 style={{ ...titleStyle, marginBottom: "20px" }}>{slide.title}</h2>
      )}
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
        {(slide.content || []).map((item, i) => (
          <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
            {useCards ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  flex: 1,
                  background: css.cardBg,
                  borderRadius: css.cardRadius,
                  padding: css.cardPadding,
                  boxShadow: css.cardShadow,
                }}
              >
                <span style={{ color: css.accentColor, flexShrink: 0, marginTop: "1px" }}>{css.bulletChar}</span>
                {editing ? (
                  <input
                    value={item}
                    onChange={(e) => onUpdateContent?.(i, e.target.value)}
                    style={{ ...bodyStyle, flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", padding: 0 }}
                  />
                ) : (
                  <span style={bodyStyle}>{item}</span>
                )}
                <BulletRemove editing={editing} onRemove={() => onUpdateContent?.(i, null)} />
              </div>
            ) : (
              <>
                <span style={{ color: css.accentColor, flexShrink: 0, marginTop: "2px", fontFamily: css.bodyFont }}>{css.bulletChar}</span>
                {editing ? (
                  <input
                    value={item}
                    onChange={(e) => onUpdateContent?.(i, e.target.value)}
                    style={{ ...bodyStyle, flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", padding: 0 }}
                  />
                ) : (
                  <span style={bodyStyle}>{item}</span>
                )}
                <BulletRemove editing={editing} onRemove={() => onUpdateContent?.(i, null)} />
              </>
            )}
          </li>
        ))}
      </ul>
      {editing && (
        <button
          type="button"
          onClick={() => onUpdateContent?.(slide.content.length, "")}
          style={{
            marginTop: "12px",
            color: css.accentColor,
            fontSize: "12px",
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          + Add bullet
        </button>
      )}
    </div>
  );
}
