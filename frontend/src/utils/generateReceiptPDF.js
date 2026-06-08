import html2canvas from 'html2canvas';

export const generateReceiptPDF = async (element, orderId) => {
  if (!element) return;
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
  });
  const link = document.createElement('a');
  link.download = `receipt-${orderId}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
};
