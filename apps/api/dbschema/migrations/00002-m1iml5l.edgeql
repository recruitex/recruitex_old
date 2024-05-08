CREATE MIGRATION m1iml5lbkvnxntcneerjxe6oqwalnuv6pmy6husvewgouvccvwto3q
    ONTO m13hrmsmq2pamtkescqoqgnkjf4ytifsnssd2aavzyunjyet5m4zcq
{
  CREATE ABSTRACT TYPE default::Lifecycle {
      CREATE PROPERTY created: std::datetime {
          CREATE REWRITE
              INSERT 
              USING (std::datetime_of_statement());
      };
      CREATE PROPERTY updated: std::datetime {
          CREATE REWRITE
              INSERT 
              USING (std::datetime_of_statement());
          CREATE REWRITE
              UPDATE 
              USING (std::datetime_of_statement());
      };
  };
  ALTER TYPE default::User {
      EXTENDING default::Lifecycle LAST;
      ALTER PROPERTY created {
          DROP REWRITE
              INSERT ;
              DROP OWNED;
              RESET TYPE;
          };
          ALTER PROPERTY updated {
              DROP REWRITE
                  INSERT ;
                  DROP REWRITE
                      UPDATE ;
                      DROP OWNED;
                      RESET TYPE;
                  };
              };
};
