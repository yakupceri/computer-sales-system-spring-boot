package com.yakup.sales.service;

import com.yakup.sales.domain.Category;
import com.yakup.sales.domain.Product;
import com.yakup.sales.dto.ProductRequest;
import com.yakup.sales.repository.CategoryRepository;
import com.yakup.sales.repository.ProductRepository;
import com.yakup.sales.specification.FiltersSpecification;
import com.yakup.sales.specification.IBaseFilterService;

import lombok.RequiredArgsConstructor;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class ProductService implements IBaseFilterService<Product, ProductRepository> {

    private final ProductRepository repo;
    private final CategoryRepository categoryRepository;
    private final FiltersSpecification<Product> filters;

    @Override public ProductRepository getRepository() { return repo; }
    @Override public FiltersSpecification<Product> getFiltersSpecification() { return filters; }

    public Product findById(Long id) {
        return repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ürün bulunamadı: " + id));
    }

    public Product create(ProductRequest request) {
        String sku = request.sku().trim();
        if (repo.existsBySkuIgnoreCase(sku)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bu SKU ile kayıtlı bir ürün zaten var: " + sku);
        }
        Product product = new Product();
        apply(product, request, sku);
        return repo.save(product);
    }

    public Product update(Long id, ProductRequest request) {
        Product product = findById(id);
        String sku = request.sku().trim();
        if (repo.existsBySkuIgnoreCaseAndIdNot(sku, id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bu SKU ile kayıtlı bir ürün zaten var: " + sku);
        }
        apply(product, request, sku);
        return repo.save(product);
    }

    public void delete(Long id) {
        Product product = findById(id);
        try {
            repo.delete(product);
        } catch (DataIntegrityViolationException e) {
            // order_items ve stock_movements tabloları ürüne foreign key ile bağlı
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Bu ürün siparişlerde veya stok hareketlerinde kullanıldığı için silinemez: " + product.getName());
        }
    }

    private void apply(Product product, ProductRequest request, String sku) {
        Category category = categoryRepository.findById(request.categoryId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Kategori bulunamadı: " + request.categoryId()));
        product.setName(request.name().trim());
        product.setSku(sku);
        product.setPrice(request.price());
        product.setStockQuantity(request.stockQuantity());
        product.setCategory(category);
    }
}
