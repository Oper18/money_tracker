from orator.migrations import Migration


class AddListData(Migration):

    def up(self):
        """
        Run the migrations.
        """

        currencies = ['rub', 'eur', 'usd']

        for c in currencies:
            self.db.table('currencies').insert(name=c)

    def down(self):
        """
        Revert the migrations.
        """

        self.db.table('currencies').delete()
