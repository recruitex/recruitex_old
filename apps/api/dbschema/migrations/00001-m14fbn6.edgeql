CREATE MIGRATION m14fbn6uulyxti3w6ja76nt5trkwhp5b7mm7fultfv3ald52f6rcea
    ONTO initial
{
  CREATE EXTENSION pgcrypto VERSION '1.3';
  CREATE EXTENSION auth VERSION '1.0';
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
  CREATE TYPE default::User EXTENDING default::Lifecycle {
      CREATE REQUIRED MULTI LINK identity: ext::auth::Identity {
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE PROPERTY email: std::str;
      CREATE PROPERTY emailVerified: std::bool;
      CREATE PROPERTY name: std::str;
  };
  CREATE GLOBAL default::current_user := (std::assert_single((SELECT
      default::User
  FILTER
      (.identity = GLOBAL ext::auth::ClientTokenIdentity)
  )));
  CREATE TYPE default::Invitation EXTENDING default::Lifecycle {
      CREATE REQUIRED PROPERTY email: std::str;
      CREATE REQUIRED PROPERTY expiresAt: std::datetime;
  };
  CREATE TYPE default::Organization EXTENDING default::Lifecycle {
      CREATE PROPERTY description: std::str;
      CREATE PROPERTY logoUrl: std::str;
      CREATE REQUIRED PROPERTY name: std::str {
          CREATE CONSTRAINT std::exclusive;
      };
  };
  ALTER TYPE default::Invitation {
      CREATE REQUIRED LINK organization: default::Organization;
  };
  ALTER TYPE default::Organization {
      CREATE MULTI LINK invitations := (.<organization[IS default::Invitation]);
  };
  CREATE SCALAR TYPE default::OrganizationRole EXTENDING enum<admin, recruiter, candidate>;
  CREATE TYPE default::UserInOrganization EXTENDING default::Lifecycle {
      CREATE REQUIRED LINK organization: default::Organization;
      CREATE REQUIRED LINK user: default::User;
      CREATE REQUIRED PROPERTY role: default::OrganizationRole;
  };
  ALTER TYPE default::Organization {
      CREATE MULTI LINK users := (.<organization[IS default::UserInOrganization]);
  };
  ALTER TYPE default::User {
      CREATE MULTI LINK organizations := (.<user[IS default::UserInOrganization]);
  };
};
