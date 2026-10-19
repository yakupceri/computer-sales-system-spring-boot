package com.yakup.sales.specification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import com.yakup.sales.domain.Category;
import com.yakup.sales.domain.Product;
import com.yakup.sales.dto.RequestDto;
import com.yakup.sales.dto.SearchRequestDto;
import com.yakup.sales.dto.SearchRequestDto.Operation;
import com.yakup.sales.repository.CategoryRepository;
import com.yakup.sales.repository.ProductRepository;

@DataJpaTest
class FiltersSpecificationTest {

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    private final FiltersSpecification<Product> filters = new FiltersSpecification<>();

    @BeforeEach
    void setUp() {
        Category laptop = category("Laptop");
        Category monitor = category("Monitor");
        product("Lenovo ThinkPad", "SKU-1", "1500.00", laptop);
        product("Lenovo IdeaPad", "SKU-2", "200.00", laptop);
        product("Dell Monitor", "SKU-3", "9000.00", monitor);
    }

    @Test
    void returnsAllWhenNoFilters() {
        assertThat(search(null, RequestDto.GlobalOperator.AND)).hasSize(3);
        assertThat(search(List.of(), RequestDto.GlobalOperator.OR)).hasSize(3);
    }

    @Test
    void comparesNumbersNumerically() {
        // "200" > "1000" alfabetik olarak doğru olurdu; sayısal olarak değil
        var result = search(List.of(filter("price", Operation.GREATER_THAN, "1000", null)), RequestDto.GlobalOperator.AND);
        assertThat(result).extracting(Product::getSku).containsExactlyInAnyOrder("SKU-1", "SKU-3");
    }

    @Test
    void likeIsCaseInsensitive() {
        var result = search(List.of(filter("name", Operation.LIKE, "lenovo", null)), RequestDto.GlobalOperator.AND);
        assertThat(result).hasSize(2);
    }

    @Test
    void filtersThroughJoin() {
        var result = search(List.of(filter("name", Operation.EQUAL, "Laptop", "category")), RequestDto.GlobalOperator.AND);
        assertThat(result).extracting(Product::getSku).containsExactlyInAnyOrder("SKU-1", "SKU-2");
    }

    @Test
    void rejectsUnknownColumn() {
        assertThatThrownBy(() -> search(List.of(filter("fiyat", Operation.EQUAL, 5, null)), RequestDto.GlobalOperator.AND))
                .hasRootCauseInstanceOf(IllegalArgumentException.class)
                .hasStackTraceContaining("Geçersiz kolon: fiyat");
    }

    @Test
    void rejectsMissingOperation() {
        assertThatThrownBy(() -> search(List.of(filter("price", null, 5, null)), RequestDto.GlobalOperator.AND))
                .hasStackTraceContaining("operation alanı zorunludur");
    }

    @Test
    void rejectsInvalidValueForType() {
        assertThatThrownBy(() -> search(List.of(filter("price", Operation.GREATER_THAN, "abc", null)), RequestDto.GlobalOperator.AND))
                .hasStackTraceContaining("price alanı için geçersiz");
    }

    private List<Product> search(List<SearchRequestDto> searchDtos, RequestDto.GlobalOperator operator) {
        return productRepository.findAll(filters.getSearchSpecification(new RequestDto(searchDtos, operator)));
    }

    private SearchRequestDto filter(String column, Operation operation, Object value, String join) {
        return new SearchRequestDto(column, value, operation, join);
    }

    private Category category(String name) {
        Category category = new Category();
        category.setName(name);
        return categoryRepository.save(category);
    }

    private void product(String name, String sku, String price, Category category) {
        Product product = new Product();
        product.setName(name);
        product.setSku(sku);
        product.setPrice(new BigDecimal(price));
        product.setStockQuantity(10);
        product.setCategory(category);
        productRepository.save(product);
    }
}
