# Examples

This folder contains template files for reference when creating new:

| File | Purpose | Copy To |
|------|---------|---------|
| **RepositoryTemplate.ts** | How to create a repository | `src/services/repositories/` |
| **MockTemplate.ts** | How to create mock data | `src/services/mocks/` |
| **QueryHookTemplate.ts** | How to create a TanStack Query hook | `src/hooks/` |

## Usage

1. Copy the template file to the appropriate folder
2. Rename following the naming convention:
   - Repositories: `PascalCaseRepository.ts` (e.g., `UserRepository.ts`)
   - Mocks: `camelCaseMocks.ts` (e.g., `userMocks.ts`)
   - Hooks: `usePascalCaseQuery.ts` (e.g., `useUserQuery.ts`)
3. Update the content for your domain

## Note

These files are **excluded from validation**. They exist only as reference.
