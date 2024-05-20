CREATE MIGRATION m16zxevtq4tirawirdy6y33kadr4ibezrc2t7jul6cevi3pxwiyyva
    ONTO m1el3i5unmhivjmjhopxqelx35nwdf7qgh3sxegv6q7wzmwiedmuua
{
  ALTER TYPE default::User {
      CREATE PROPERTY emailVerified: std::bool;
      ALTER PROPERTY emailAndVerification {
          USING ((IF .emailVerified THEN .email ELSE ((.email ++ '/') ++ .emailVerificationChallengeDuplicate)));
      };
  };
};
