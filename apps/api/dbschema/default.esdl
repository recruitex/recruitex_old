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

  type EmailVerification extending Lifecycle {
    required email: str;
    required challenge: str;
    required expiresAt: datetime;

    user := .<emailVerification[is User];
  }

  type User extending Lifecycle {
      required multi identity: ext::auth::Identity {
        constraint exclusive;
      };
      name: str;
      email: str;
      emailVerified: bool;
      emailVerification: EmailVerification;
      emailVerificationChallengeDuplicate: str;
      emailAndVerification := if (.emailVerified) then (.email) else (.email ++ '\/' ++ .emailVerificationChallengeDuplicate);

      multi organizations := .<user[is UserInOrganization];

      constraint exclusive on (.emailAndVerification);
  }

  type UserInOrganization extending Lifecycle {
    required user: User {
      on source delete delete target;
    };
    required organization: Organization {
      on source delete delete target;
    };
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
