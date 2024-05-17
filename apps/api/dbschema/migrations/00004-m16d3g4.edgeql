CREATE MIGRATION m16d3g4sfuwldsjfeanuf7uhji2t5otfhkf7sjkmrbdaqfdqgh243a
    ONTO m1gteu42jmlfargubku3wqdv44unfzatxs2rk3kvul6e562ng55diq
{
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
  ALTER TYPE default::User {
      DROP PROPERTY userRole;
  };
  ALTER SCALAR TYPE default::Role RENAME TO default::OrganizationRole;
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
