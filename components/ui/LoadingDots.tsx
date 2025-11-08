import styles from '@/styles/loading-dots.module.css';

interface LoadingDotsProps {
  color?: string;
  style?: 'small' | 'large';
}

const LoadingDots = ({ color = '#33F699', style = 'small' }: LoadingDotsProps) => {
  return (
    <span className={style == 'small' ? styles.loading2 : styles.loading}>
      <span style={{ backgroundColor: color }} />
      <span style={{ backgroundColor: color }} />
      <span style={{ backgroundColor: color }} />
    </span>
  );
};

export default LoadingDots;
