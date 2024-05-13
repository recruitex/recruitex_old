CREATE MIGRATION m1gteu42jmlfargubku3wqdv44unfzatxs2rk3kvul6e562ng55diq
    ONTO m1iml5lbkvnxntcneerjxe6oqwalnuv6pmy6husvewgouvccvwto3q
{
  ALTER TYPE default::User {
      ALTER PROPERTY name {
          RESET OPTIONALITY;
      };
      ALTER PROPERTY userRole {
          SET default := 'recruiter';
      };
  };
};
