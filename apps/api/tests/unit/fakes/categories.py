from ecommerce_api.domain.product import Category


class InMemoryCategoryRepository:
    def __init__(self) -> None:
        self.rows: list[Category] = []

    async def find_or_create(self, name: str) -> Category:
        for row in self.rows:
            if row.name.lower() == name.lower():
                return row
        created = Category(id=f'category-{len(self.rows) + 1}', name=name)
        self.rows.append(created)
        return created

    async def find_all(self) -> list[Category]:
        return sorted(self.rows, key=lambda row: row.name)
