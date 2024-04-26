import styles from './page.module.css';
import type { ReactElement } from 'react';

const Home = (): ReactElement => {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Welcome to Recruitex!</h1>
    </main>
  );
};

export default Home;
