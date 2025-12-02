export default function Loading() {
  return (
    <div className="pt-20 md:pt-24 animate-pulse">
      {/* Hero section skeleton */}
      <div className="h-[500px] md:h-[600px] bg-gray-200 rounded-lg mb-8" />

      {/* Partners section skeleton */}
      <div className="container mx-auto px-4 mb-8">
        <div className="h-8 w-48 bg-gray-200 rounded mx-auto mb-6" />
        <div className="flex justify-center gap-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 w-32 bg-gray-200 rounded" />
          ))}
        </div>
      </div>

      {/* Features section skeleton */}
      <div className="container mx-auto px-4 mb-8">
        <div className="grid md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-[300px] bg-gray-200 rounded-lg" />
          ))}
        </div>
      </div>

      {/* Terms section skeleton */}
      <div className="h-[400px] bg-gray-200 rounded-lg" />
    </div>
  )
}
