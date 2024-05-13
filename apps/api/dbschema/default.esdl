using extension auth;

module default {
  scalar type Role extending enum<admin, recruiter, candidate>;

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

      userRole: Role {
        default := "recruiter";
      };
    }
};
