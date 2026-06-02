import { useState, useRef, useEffect } from 'react';
import { Row, Col, Button, InputNumber, message } from 'antd';
import { PlusOutlined, MinusOutlined } from '@ant-design/icons';
import { qtyLabel } from '../utils/format.js';

const ALLOWED_KEYS = new Set([
  'Backspace', 'Delete', 'Tab', 'Enter', 'Escape',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'Home', 'End',
]);

const QtyInput = ({ value, onChange, isFabric, min, max, disabled }) => {
  const [hasError, setHasError] = useState(false);
  const timerRef = useRef(null);
  const valueRef = useRef(value);
  const step = isFabric ? 0.25 : 1;
  const resolvedMin = min ?? (isFabric ? 0.25 : 1);

  useEffect(() => { valueRef.current = value; }, [value]);

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  const showError = () => {
    setHasError(true);
    message.warning({ content: 'Only numbers allowed', duration: 1 });
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setHasError(false), 1000);
  };

  const handleDelta = (delta) => {
    const current = valueRef.current ?? resolvedMin;
    const raw = current + delta;
    const clamped = max != null ? Math.min(max, raw) : raw;
    const newVal = Math.max(resolvedMin, +((clamped).toFixed(2)));
    onChange?.(newVal);
  };

  const handleKeyDown = (e) => {
    if (ALLOWED_KEYS.has(e.code)) return;
    if (e.ctrlKey || e.metaKey) return;
    if (e.code.startsWith('Digit') || e.code.startsWith('Numpad')) return;
    e.preventDefault();
    showError();
  };

  return (
    <Row align="middle" gutter={4} wrap={false}>
      <Col>
        <Button
          size="small"
          icon={<MinusOutlined />}
          disabled={disabled}
          onClick={() => handleDelta(-step)}
        />
      </Col>
      <Col flex="auto">
        <InputNumber
          controls={false}
          min={resolvedMin}
          max={max}
          step={step}
          precision={isFabric ? undefined : 0}
          value={value}
          disabled={disabled}
          status={hasError ? 'error' : undefined}
          onKeyDown={handleKeyDown}
          onChange={(val) => onChange?.(val)}
          formatter={(v) => qtyLabel(Number(v))}
          parser={(display) => {
            const fracMap = { '¼': 0.25, '½': 0.5, '¾': 0.75 };
            for (const [char, val] of Object.entries(fracMap)) {
              if (display.includes(char)) {
                const before = display.split(char)[0].trim();
                const whole = before ? parseInt(before) || 0 : 0;
                return whole + val;
              }
            }
            const num = parseFloat(display.replace(/[^\d.]/g, ''));
            return isNaN(num) ? 0 : num;
          }}
          style={{ width: '100%', textAlign: 'center' }}
        />
      </Col>
      <Col>
        <Button
          size="small"
          icon={<PlusOutlined />}
          disabled={disabled}
          onClick={() => handleDelta(step)}
        />
      </Col>
    </Row>
  );
};

export default QtyInput;
