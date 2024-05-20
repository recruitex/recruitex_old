CREATE MIGRATION m1wrajvbu5vhgaza3ker7mtmdlhswuloeowf4dl2qzlca56bechlxa
    ONTO m14ectursqolqbz7bsxkns62f7k7tawkledzuuo5nvywmqu32pmywa
{
  CREATE TYPE default::EmailVerification EXTENDING default::Lifecycle {
      CREATE REQUIRED PROPERTY challenge: std::str;
      CREATE REQUIRED PROPERTY email: std::str;
      CREATE REQUIRED PROPERTY expiresAt: std::datetime;
  };
  ALTER TYPE default::User {
      CREATE LINK emailVerification: default::EmailVerification;
  };
  ALTER TYPE default::User {
      CREATE PROPERTY emailVerificationChallengeDuplicate: std::str;
  };
  ALTER TYPE default::User {
      ALTER PROPERTY emailWithVerification {
          RENAME TO emailAndVerification;
      };
  };
  ALTER TYPE default::User {
      ALTER PROPERTY emailAndVerification {
          USING ((IF EXISTS (.emailVerificationChallengeDuplicate) THEN ((.email ++ '/') ++ .emailVerificationChallengeDuplicate) ELSE .email));
      };
      CREATE CONSTRAINT std::exclusive ON (.emailAndVerification);
  };
  ALTER TYPE default::User {
      DROP PROPERTY emailVerified;
  };
  ALTER TYPE default::UserInOrganization {
      ALTER LINK organization {
          ON SOURCE DELETE DELETE TARGET;
      };
      ALTER LINK user {
          ON SOURCE DELETE DELETE TARGET;
      };
  };
};
