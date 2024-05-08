using extension auth;

module default {
  scalar type Role extending enum<admin, recruiter, candidate>;

  global current_user := (
      assert_single((
        select User
        filter .identity = global ext::auth::ClientTokenIdentity
      ))
    );

  type User {
      required identity: ext::auth::Identity {
        constraint exclusive;
      };
      required name: str;
      email: str;

      userRole: Role {
        default := "candidate";
      };

      created: datetime {
        rewrite insert using (datetime_of_statement());
      }
      updated: datetime {
        rewrite insert using (datetime_of_statement());
        rewrite update using (datetime_of_statement());
      }
    }
};