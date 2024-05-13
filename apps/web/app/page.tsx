'use client';

import { Button } from '@repo/ui/button';
import { use, cache } from 'react';

const getInit = cache(async () => {
  return fetch('http://localhost:3001/', {
    cache: 'no-cache',
    credentials: 'include',
  }).then((res) => res.text());
});

const Home = () => {
  const response = use(getInit());

  const redirectUrl = encodeURIComponent('http://localhost:3000/');
  const signinUrl = `http://localhost:3001/auth/ui/signin?redirect_url=${redirectUrl}`;
  const signupUrl = `http://localhost:3001/auth/ui/signin?redirect_url=${redirectUrl}`;
  const signoutUrl = `http://localhost:3001/auth/signout?redirect_url=${redirectUrl}`;

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-between p-4">
      <h1 className="text-4xl font-bold ">Welcome to Recruitex!</h1>
      <h2>{response}</h2>
      <a href={signinUrl}>Sign in</a>
      <a href={signupUrl}>Sign up</a>
      <a href={signoutUrl}>Sign out</a>
    </main>
  );
};

export default Home;
