import styles from './Footer.module.css';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.content}>
        <h3 className={styles.title}>Instituto Tecnológico de Tizimín</h3>
        <p className={styles.text}>Plataforma de Gestión Académica y Entornos Virtuales</p>
        <p className={styles.text}>Excelencia en Educación Tecnológica</p>
        
        <div className={styles.copyright}>
          &copy; {currentYear} TecNM Campus Tizimín. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  );
}