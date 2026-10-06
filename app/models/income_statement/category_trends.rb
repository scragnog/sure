# Monthly net spending per parent category over the months leading up to a
# report's end date, for the "Category trends" Reports section: one small
# chart per category, so trends and one-off spikes show up side by side.
#
# Each month uses IncomeStatement#net_category_totals (expense minus refunds
# per parent category, as the cash flow Sankey nets them), so the figures and
# scoping match the rest of Reports.
class IncomeStatement::CategoryTrends
  MONTHS = 24

  Series = Data.define(:category, :values) do
    def total
      values.sum
    end

    def average
      values.empty? ? 0 : total / values.size
    end

    def peak
      values.max || 0
    end
  end

  attr_reader :months

  def initialize(income_statement, end_date:, months: MONTHS)
    @income_statement = income_statement
    @end_date = end_date
    last = end_date.beginning_of_month
    @months = (0...months).map { |i| last - (months - 1 - i).months }
  end

  # The last month runs only to end_date when that falls mid-month.
  def partial_last_month?
    @end_date < @end_date.end_of_month
  end

  # Parent categories (and Uncategorized) with any net spending in the
  # window, largest total first.
  def series
    @series ||= begin
      by_key = {}
      months.each_with_index do |month, i|
        period = Period.custom(start_date: month, end_date: [ month.end_of_month, @end_date ].min)
        @income_statement.net_category_totals(period: period).net_expense_categories.each do |ct|
          entry = by_key[key_for(ct.category)] ||= { category: ct.category, values: Array.new(months.size, 0) }
          entry[:values][i] += ct.total
        end
      end

      by_key.values
        .map { |e| Series.new(category: e[:category], values: e[:values]) }
        .select { |s| s.total.positive? }
        .sort_by { |s| -s.total }
    end
  end

  private
    def key_for(category)
      return :uncategorized if category.uncategorized?
      return :other_investments if category.other_investments?

      category.id
    end
end
