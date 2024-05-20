CREATE MIGRATION m14ectursqolqbz7bsxkns62f7k7tawkledzuuo5nvywmqu32pmywa
    ONTO m14fbn6uulyxti3w6ja76nt5trkwhp5b7mm7fultfv3ald52f6rcea
{
  ALTER TYPE default::User {
      CREATE PROPERTY emailWithVerification := ((.email ++ (IF .emailVerified THEN '' ELSE ' (unverified)')));
  };
};
