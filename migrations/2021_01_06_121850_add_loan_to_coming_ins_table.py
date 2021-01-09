from orator.migrations import Migration


class AddLoanToComingInsTable(Migration):

    def up(self):
        """
        Run the migrations.
        """

        with self.schema.table('coming_ins') as table:
            table.integer('loan').nullable()

    def down(self):
        """
        Revert the migrations.
        """

        with self.schema.table('coming_ins') as table:
            table.drop_column('loan')
