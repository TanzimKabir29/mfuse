import { useEffect, useState } from "react";
import QRCode from "qrcode";

const QR_SIZE = 160;

interface SecretQrCodeProps {
  value: string;
}

function SecretQrCode({ value }: SecretQrCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    QRCode.toDataURL(value, { width: QR_SIZE, margin: 1 }).then((url) => {
      if (!cancelled) {
        setDataUrl(url);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [value]);

  if (!dataUrl) {
    return null;
  }

  return (
    <img
      src={dataUrl}
      alt="QR code for the secret link"
      width={QR_SIZE}
      height={QR_SIZE}
      className="mx-auto rounded-md border border-line"
    />
  );
}

export default SecretQrCode;
