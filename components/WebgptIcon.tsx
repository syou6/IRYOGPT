import clsx from 'clsx';
import Image from 'next/image';

interface WebgptIconProps {
  size?: number;
  className?: string;
}

export default function WebgptIcon({ size = 32, className }: WebgptIconProps) {
  return (
    <span
      className={clsx(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-premium-stroke/70 bg-premium-base',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Image src="/icons/bee-icon.png" alt="よやくらく アイコン" fill sizes={`${size}px`} className="object-contain" />
    </span>
  );
}
