import { useState } from 'react';
import { Modal, Button } from 'antd';
import { BgColorsOutlined, CloseOutlined } from '@ant-design/icons';

function hexToHsl(hex) {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (x) => {
    const hx = Math.round(x * 255).toString(16);
    return hx.length === 1 ? '0' + hx : hx;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

const STANDARD_COLORS = [
  '#FF0000', '#FF7F00', '#FFFF00', '#00B050', '#0070C0', '#7030A0',
];

const DEFAULT_BASE_COLORS = [
  '#FFFFFF', '#000000', '#5B9BD5', '#2E75B6', '#00A2E8',
  '#008080', '#70AD47', '#A9D18E', '#ED7D31', '#7030A0',
];

function generateShades(baseColors) {
  return baseColors.map((hex) => {
    const hsl = hexToHsl(hex);
    const col = [hex];
    for (let i = 1; i < 6; i++) {
      const factor = i / 6;
      const l = Math.max(2, hsl.l * (1 - factor * 0.7));
      const s = Math.max(0, hsl.s * (1 - factor * 0.3));
      col.push(hslToHex(hsl.h, s, l));
    }
    return col;
  });
}

function generateThemeFromColor(hex) {
  const hsl = hexToHsl(hex);
  const columns = [];
  for (let col = 0; col < 10; col++) {
    const baseL = 93 - (col * 85 / 9);
    const baseS = Math.max(0, hsl.s * (1 - col / 14));
    const column = [hslToHex(hsl.h, baseS, baseL)];
    for (let row = 1; row < 6; row++) {
      const factor = row / 6;
      const l = Math.max(2, baseL * (1 - factor * 0.7));
      column.push(hslToHex(hsl.h, baseS, l));
    }
    columns.push(column);
  }
  return columns;
}

export default function ColorPickerModal({ visible, onClose, onColorSelect }) {
  const defaultGrid = generateShades(DEFAULT_BASE_COLORS);
  const [themeGrid, setThemeGrid] = useState(defaultGrid);
  const [hoveredKey, setHoveredKey] = useState(null);
  const [clickedKey, setClickedKey] = useState(null);
  const [clickedColor, setClickedColor] = useState(null);
  const [selectedColors, setSelectedColors] = useState([]);
  const [activeStandardColor, setActiveStandardColor] = useState(null);

  const getColor = (key) => {
    if (!key) return null;
    const [ci, ri] = key.split('-').map(Number);
    return themeGrid[ci]?.[ri] ?? null;
  };

  const handleStandardClick = (hex) => {
    if (hex === activeStandardColor) {
      setThemeGrid(defaultGrid);
      setActiveStandardColor(null);
    } else {
      setThemeGrid(generateThemeFromColor(hex));
      setActiveStandardColor(hex);
    }
    setClickedKey(null);
    setClickedColor(hex);
  };

  const handleSwatchClick = (key, color) => {
    setClickedKey(key);
    setClickedColor(color);
  };

  const handleSelect = () => {
    const hex = getColor(clickedKey) || getColor(hoveredKey);
    if (hex && !selectedColors.includes(hex)) {
      setSelectedColors([...selectedColors, hex]);
    }
  };

  const handleRemoveColor = (hex) => {
    setSelectedColors(selectedColors.filter((c) => c !== hex));
  };

  const handleEnter = () => {
    const colors = selectedColors.length > 0 ? selectedColors : (clickedColor ? [clickedColor] : []);
    if (colors.length > 0) {
      onColorSelect(colors);
      onClose();
    }
  };

  const handleMoreColors = () => {
    const input = document.createElement('input');
    input.type = 'color';
    input.value = '#FFFFFF';
    input.addEventListener('input', (e) => {
      const val = e.target.value.toUpperCase();
      setClickedKey(null);
      setClickedColor(val);
    });
    input.click();
  };

  const stdSwatch = 24;

  return (
    <Modal
      title="Colors"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={520}
      centered
      destroyOnClose
    >
      <div style={{ display: 'flex', gap: 3, marginBottom: 4, width: '100%', padding: '6px 0' }}>
        {themeGrid.map((col, ci) => (
          <div key={ci} style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
            {col.map((color, ri) => {
              const key = `${ci}-${ri}`;
              const isHov = hoveredKey === key;
              const isSel = clickedKey === key;
              return (
                <div
                  key={ri}
                  style={{
                    width: '100%',
                    aspectRatio: 1,
                    backgroundColor: color,
                    border: isSel
                      ? '3px solid #000'
                      : isHov
                        ? '3px solid #666'
                        : '1px solid #d9d9d9',
                    cursor: 'pointer',
                    borderRadius: 2,
                    boxSizing: 'border-box',
                    transition: 'transform 0.12s ease, border 0.12s ease',
                    transform: isHov || isSel ? 'scale(1.35)' : 'scale(1)',
                    zIndex: isHov || isSel ? 2 : 'auto',
                    position: 'relative',
                  }}
                  onClick={() => handleSwatchClick(key, color)}
                  onMouseEnter={() => setHoveredKey(key)}
                  onMouseLeave={() => setHoveredKey(null)}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 20 }}>Shade Colors</div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
        {STANDARD_COLORS.map((color) => (
          <div
            key={color}
            style={{
              width: stdSwatch,
              height: stdSwatch,
              backgroundColor: color,
              border: activeStandardColor === color ? '3px solid #000' : '1px solid #d9d9d9',
              cursor: 'pointer',
              borderRadius: 2,
              flexShrink: 0,
              boxSizing: 'border-box',
            }}
            onClick={() => handleStandardClick(color)}
          />
        ))}
      </div>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>Standard Colors</div>

      {selectedColors.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {selectedColors.map((hex) => (
            <div
              key={hex}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                borderRadius: 20,
                border: '1px solid #d9d9d9',
                padding: '3px 10px 3px 6px',
                background: '#fafafa',
              }}
            >
              <CloseOutlined
                style={{ fontSize: 11, cursor: 'pointer', color: '#999', flexShrink: 0 }}
                onClick={() => handleRemoveColor(hex)}
              />
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  backgroundColor: hex,
                  border: '1px solid #d9d9d9',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 12, fontFamily: 'monospace' }}>{hex}</span>
            </div>
          ))}
        </div>
      )}

      <div
        style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24, cursor: 'pointer', color: '#1677ff' }}
        onClick={handleMoreColors}
      >
        <BgColorsOutlined style={{ fontSize: 18 }} />
        <span style={{ fontSize: 15 }}>More Colors...</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button onClick={handleSelect}>Select</Button>
          <Button type="primary" onClick={handleEnter}>Enter</Button>
        </div>
        {clickedColor && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, backgroundColor: clickedColor, border: '1px solid #d9d9d9', borderRadius: 3 }} />
            <span style={{ fontSize: 14, fontFamily: 'monospace', fontWeight: 600 }}>{clickedColor}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
