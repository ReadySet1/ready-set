import { useUserContext, userHelpers } from '@/providers/UserProvider'
import { getCurrentUserServer } from '@/lib/auth/user-sync'

/**
 * Client Component Example
 */
export function UserProfile() {
  const user = useUserContext()

  if (user.isLoading) {
    return <div>Loading...</div>
  }

  if (!userHelpers.isAuthenticated(user)) {
    return <div>Please sign in</div>
  }

  return (
    <div className="p-4">
      <h1>Welcome, {user.profile?.name}!</h1>
      <p>Email: {user.profile?.email}</p>
      <p>User Type: {user.profile?.type}</p>
      <p>Status: {user.profile?.status}</p>
      
      {user.isNewUser && (
        <div className="bg-blue-100 p-4 rounded">
          Welcome to ReadySet! Please complete your profile.
        </div>
      )}
      
      {userHelpers.isAdmin(user) && (
        <div className="bg-red-100 p-4 rounded">
          Admin Panel Access Available
        </div>
      )}
      
      <button 
        onClick={user.signOut}
        className="bg-red-500 text-white px-4 py-2 rounded"
      >
        Sign Out
      </button>
    </div>
  )
}

/**
 * Server Component Example
 */
export async function ServerUserProfile() {
  const { profile, isNewUser, error } = await getCurrentUserServer()
  
  if (error) {
    return <div>Error: {error}</div>
  }

  if (!profile) {
    return <div>Please sign in</div>
  }

  return (
    <div className="p-4">
      <h1>Server-side Profile</h1>
      <p>Name: {profile.name}</p>
      <p>Email: {profile.email}</p>
      <p>Type: {profile.type}</p>
      
      {isNewUser && (
        <div className="bg-green-100 p-4 rounded">
          New user detected - showing onboarding flow
        </div>
      )}
    </div>
  )
}