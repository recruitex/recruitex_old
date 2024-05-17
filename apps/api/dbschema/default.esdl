using extension auth;

module default {
  scalar type OrganizationRole extending enum<admin, recruiter, candidate>;

  global current_user := (
      assert_single((
        select User
        filter .identity = global ext::auth::ClientTokenIdentity
      ))
    );

  abstract type Lifecycle {
      created: datetime {
        rewrite insert using (datetime_of_statement());
      }
      updated: datetime {
        rewrite insert using (datetime_of_statement());
        rewrite update using (datetime_of_statement());
      }
  }

  type User extending Lifecycle {
      required identity: ext::auth::Identity {
        constraint exclusive;
      };
      name: str;
      email: str;
      multi organizations := .<user[is UserInOrganization];
  }

  type UserInOrganization extending Lifecycle {
    required user: User;
    required organization: Organization;
    required role: OrganizationRole;
  }

  type Organization extending Lifecycle {
    required name: str {
      constraint exclusive;
    };
    description: str;
    logoUrl: str;

    multi users := .<organization[is UserInOrganization];
    multi invitations := .<organization[is Invitation];
  }

  type Invitation extending Lifecycle {
    required email: str;
    required organization: Organization;
    required expiresAt: datetime;
  }
};
