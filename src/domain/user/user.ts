import { Context, Effect, Layer } from "effect"
import { SqlError } from "effect/unstable/sql"
import {
  LinkedAccountConflictError,
  LinkedAccountNotFoundError,
  UserAlreadyDeletedError,
  UserNotFoundError,
} from "./user.error.ts"
import { CreateUserInput, LinkAccountInput, LinkedAccount, UpdateUserInput, User } from "./user.type.ts"
import { UserRepo } from "./user.sql.ts"

export class UserService extends Context.Service<UserService, {
  create(input: CreateUserInput): Effect.Effect<User, SqlError.SqlError>
  findById(userId: string): Effect.Effect<User, UserNotFoundError | SqlError.SqlError>
  update(userId: string, input: UpdateUserInput): Effect.Effect<User, UserNotFoundError | SqlError.SqlError>
  softDelete(userId: string): Effect.Effect<void, UserNotFoundError | UserAlreadyDeletedError | SqlError.SqlError>
  linkAccount(input: LinkAccountInput): Effect.Effect<LinkedAccount, LinkedAccountConflictError | SqlError.SqlError>
  unlinkAccount(userId: string, externalSystem: string): Effect.Effect<void, LinkedAccountNotFoundError | SqlError.SqlError>
  getLinkedAccounts(userId: string): Effect.Effect<ReadonlyArray<LinkedAccount>, SqlError.SqlError>
}>()("sso/domain/UserService") {
  static readonly layer = Layer.effect(
    UserService,
    Effect.gen(function* () {
      const repo = yield* UserRepo

      const create = Effect.fn("UserService.create")(function* (
        input: CreateUserInput
      ): Effect.fn.Return<User, SqlError.SqlError> {
        return yield* repo.insert(input.displayName, input.avatarUrl)
      })

      const findById = Effect.fn("UserService.findById")(function* (
        userId: string
      ): Effect.fn.Return<User, UserNotFoundError | SqlError.SqlError> {
        const user = yield* repo.findById(userId)
        if (!user) return yield* new UserNotFoundError({ userId })
        return user
      })

      const update = Effect.fn("UserService.update")(function* (
        userId: string,
        input: UpdateUserInput
      ): Effect.fn.Return<User, UserNotFoundError | SqlError.SqlError> {
        const user = yield* repo.updateById(userId, input.displayName, input.avatarUrl)
        if (!user) return yield* new UserNotFoundError({ userId })
        return user
      })

      const softDelete = Effect.fn("UserService.softDelete")(function* (
        userId: string
      ): Effect.fn.Return<void, UserNotFoundError | UserAlreadyDeletedError | SqlError.SqlError> {
        const user = yield* findById(userId)
        if (user.deletedAt !== null) return yield* new UserAlreadyDeletedError({ userId })
        yield* repo.softDeleteById(userId)
      })

      const linkAccount = Effect.fn("UserService.linkAccount")(function* (
        input: LinkAccountInput
      ): Effect.fn.Return<LinkedAccount, LinkedAccountConflictError | SqlError.SqlError> {
        const existing = yield* repo.findLinkedAccountActive(input.userId, input.externalSystem)
        if (existing) {
          return yield* new LinkedAccountConflictError({
            userId:         input.userId,
            externalSystem: input.externalSystem,
          })
        }
        return yield* repo.insertLinkedAccount(
          input.userId,
          input.externalUserId,
          input.externalSystem,
          input.scope
        )
      })

      const unlinkAccount = Effect.fn("UserService.unlinkAccount")(function* (
        userId: string,
        externalSystem: string
      ): Effect.fn.Return<void, LinkedAccountNotFoundError | SqlError.SqlError> {
        const found = yield* repo.unlinkAccount(userId, externalSystem)
        if (!found) return yield* new LinkedAccountNotFoundError({ userId, externalSystem })
      })

      const getLinkedAccounts = Effect.fn("UserService.getLinkedAccounts")(function* (
        userId: string
      ): Effect.fn.Return<ReadonlyArray<LinkedAccount>, SqlError.SqlError> {
        return yield* repo.findAllLinkedAccounts(userId)
      })

      return UserService.of({
        create, findById, update, softDelete,
        linkAccount, unlinkAccount, getLinkedAccounts,
      })
    })
  ).pipe(Layer.provide(UserRepo.layer))
}
