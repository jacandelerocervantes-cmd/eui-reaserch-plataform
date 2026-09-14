import Image from 'next/image';
import styles from './Header.module.css';

export default function Header() {
  return (
    <header className={styles.header}>

      {/* Logo Izquierdo: TecNM */}
      <div className={styles.logoBox}>
        <Image src="/logo-tecnm.png" alt="TecNM" width={305} height={446} className={`${styles.logo} ${styles.logoLeft}`} />
      </div>

      {/* Texto Central */}
      <div className={styles.titleContainer}>
        <h1 className={styles.title}>
          TECNM TIZIMÍN
        </h1>
      </div>

      {/* Logo Derecho: Tizimín */}
      <div className={styles.logoBox}>
        <Image src="/logo-tizimin.png" alt="Campus Tizimín" width={202} height={250} className={`${styles.logo} ${styles.logoRight}`} />
      </div>

    </header>
  );
}