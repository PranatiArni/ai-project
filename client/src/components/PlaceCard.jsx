function PlaceCard({ name, placeType, calmScore }) {
  return (
    <article>
      <h2>{name}</h2>
      <p>Type: {placeType}</p>
      <p>Calm score: {calmScore} out of 5</p>
    </article>
  )
}

export default PlaceCard
