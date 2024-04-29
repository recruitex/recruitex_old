import type { ReactElement } from 'react';

const Home = (): ReactElement => {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-between p-4">
      <h1 className="text-4xl font-bold ">Welcome to Recruitex!</h1>
    </main>
  );
};

export default Home;
