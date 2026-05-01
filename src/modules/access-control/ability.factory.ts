import {
  AbilityBuilder,
  createMongoAbility,
  MongoAbility,
  ExtractSubjectType,
  InferSubjects,
} from '@casl/ability';
import { Injectable } from '@nestjs/common';
import { User } from '../users/user.entity';
import { Role } from './role.entity';

export enum Action {
  Manage = 'manage',
  Create = 'create',
  Read = 'read',
  Update = 'update',
  Delete = 'delete',
}

export type Subjects = any;

export type AppAbility = MongoAbility<[Action, Subjects]>;

@Injectable()
export class AbilityFactory {
  createForUser(user: User) {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
    console.log(`[AbilityFactory] Creating ability for user: ${user.email} (ID: ${user.id})`);
    if (user.roles) {
      console.log(`[AbilityFactory] User roles: ${user.roles.map(r => r.name).join(', ')}`);
    }
    const isAdmin = (user.email && ['admin@difmo.com', 'info@difmo.com', 'hello@system.com'].includes(user.email.toLowerCase())) ||
      user.roles?.some((role) =>
        ['super admin', 'admin', 'Super Admin', 'Admin', 'ADMIN'].includes(role.name)
      );

    if (isAdmin) {
      console.log(`[AbilityFactory] Admin bypass GRANTED for ${user.email}`);
      can(Action.Manage, 'all');
      // Explicitly grant attendance to resolve any subject-matching issues
      can(Action.Manage, 'attendance' as any);
    }

    // Baseline rule: All users can read their own employee profile
    if (user.id) {
      can(Action.Read, 'employee' as any, { userId: user.id } as any);
    }

    if (user.roles) {
      user.roles.forEach((role: Role) => {
        if (role.permissions) {
          role.permissions.forEach((permission) => {
            const action = permission.action as Action;
            const resource = permission.resource;

            if (permission.conditions) {
              // Parse and replace placeholders in conditions
              let conditionsStr = permission.conditions;

              if (conditionsStr.includes('${user.')) {
                const matches = conditionsStr.match(/\${user\.([^}]+)}/g);
                if (matches) {
                  matches.forEach((match) => {
                    const field = match.replace('${user.', '').replace('}', '');
                    const value = user[field];
                    conditionsStr = conditionsStr.replace(match, value);
                  });
                }
              }

              try {
                const conditions = JSON.parse(conditionsStr);
                can(action, resource, conditions);
              } catch (e) {
                console.error(
                  `Failed to parse conditions for permission ${permission.id}:`,
                  e,
                );
              }
            } else {
              can(action, resource);
            }
          });
        }
      });
    }

    // Process direct permissions
    if (user.permissions) {
      user.permissions.forEach((permission) => {
        const action = permission.action as Action;
        const resource = permission.resource;

        if (permission.conditions) {
          let conditionsStr = permission.conditions;
          if (conditionsStr.includes('${user.')) {
            const matches = conditionsStr.match(/\${user\.([^}]+)}/g);
            if (matches) {
              matches.forEach((match) => {
                const field = match.replace('${user.', '').replace('}', '');
                const value = user[field];
                conditionsStr = conditionsStr.replace(match, value);
              });
            }
          }
          try {
            const conditions = JSON.parse(conditionsStr);
            can(action, resource, conditions);
          } catch (e) {
            console.error(
              `Failed to parse conditions for direct permission ${permission.id}:`,
              e,
            );
          }
        } else {
          can(action, resource);
        }
      });
    }

    // Example hardcoded rules for Super Admins if any
    // if (user.isAdmin) {
    //   can(Action.Manage, 'all');
    // }

    return build({
      detectSubjectType: (item) => item.constructor,
    });
  }
}
