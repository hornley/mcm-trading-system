import { Row, Col, Button, InputNumber } from 'antd';
import { PlusOutlined, MinusOutlined } from '@ant-design/icons';
import { qtyLabel } from '../utils/format.js';

const QtyInput = ({ value, onChange, isFabric, min, max, disabled }) => {
  const step = isFabric ? 0.25 : 1;
  const resolvedMin = min ?? (isFabric ? 0.25 : 1);
  const current = value ?? resolvedMin;

  const handleDelta = (delta) => {
    const raw = current + delta;
    const clamped = max != null ? Math.min(max, raw) : raw;
    const newVal = Math.max(resolvedMin, +((clamped).toFixed(2)));
    onChange?.(newVal);
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
          onChange={onChange}
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
