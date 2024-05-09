import { Button } from '@repo/ui/button';

const Home = async () => {
  const response = await fetch('http://localhost:3001/', { cache: 'no-cache' });
  const text = await response.text();
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-between p-4">
      <h1 className="text-4xl font-bold ">Welcome to Recruitex!</h1>
      <h2>{text}</h2>
      <a href="http://localhost:3001/auth/ui/signin">Sign in</a>
      <Button variant="destructive">Ta rakieta</Button>
    </main>
  );
};

export default Home;
