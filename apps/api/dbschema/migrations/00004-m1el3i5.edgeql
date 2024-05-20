CREATE MIGRATION m1el3i5unmhivjmjhopxqelx35nwdf7qgh3sxegv6q7wzmwiedmuua
    ONTO m1wrajvbu5vhgaza3ker7mtmdlhswuloeowf4dl2qzlca56bechlxa
{
  ALTER TYPE default::EmailVerification {
      CREATE LINK user := (.<emailVerification[IS default::User]);
  };
};
