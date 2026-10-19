package com.yakup.sales.specification;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;

import org.springframework.core.convert.ConversionException;
import org.springframework.core.convert.ConversionService;
import org.springframework.core.convert.support.DefaultConversionService;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Component;

import com.yakup.sales.dto.RequestDto;
import com.yakup.sales.dto.SearchRequestDto;

import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;

@Component
public class FiltersSpecification<T> {

    private static final ConversionService CONVERSION = DefaultConversionService.getSharedInstance();

    @SuppressWarnings({ "rawtypes", "unchecked" })
    public Specification<T> getSearchSpecification(RequestDto requestDto) {

        return (root, query, criteriaBuilder) -> {

            List<SearchRequestDto> filters = requestDto.getSearchRequestDto();

            // Filtre yoksa tüm kayıtları getir (SQL: 1=1)
            if (filters == null || filters.isEmpty()) {
                return criteriaBuilder.conjunction();
            }

            List<Predicate> predicates = new ArrayList<>();

            for (SearchRequestDto searchDto : filters) {

                validate(searchDto);

                Path<Comparable> path = getPath(root, searchDto);
                Class<?> fieldType = path.getJavaType();

                switch (searchDto.getOperation()) {

                    case EQUAL:
                        Comparable equalValue = convertValue(searchDto.getValue(), fieldType, searchDto.getColumn());
                        predicates.add(equalValue == null
                                ? criteriaBuilder.isNull(path)
                                : criteriaBuilder.equal(path, equalValue));
                        break;

                    case LIKE:
                        if (fieldType != String.class) {
                            throw new IllegalArgumentException(
                                    "LIKE sadece metin alanlarında kullanılabilir: " + searchDto.getColumn());
                        }
                        predicates.add(criteriaBuilder.like(
                                criteriaBuilder.lower(path.as(String.class)),
                                "%" + searchDto.getValue().toString().toLowerCase() + "%"));
                        break;

                    case GREATER_THAN:
                        predicates.add(criteriaBuilder.greaterThan(path,
                                convertValue(searchDto.getValue(), fieldType, searchDto.getColumn())));
                        break;

                    case LESS_THAN:
                        predicates.add(criteriaBuilder.lessThan(path,
                                convertValue(searchDto.getValue(), fieldType, searchDto.getColumn())));
                        break;
                }
            }

            // Eğer globalOperator OR ise, tüm koşulları OR ile bağla
            if (requestDto.getGlobalOperator() == RequestDto.GlobalOperator.OR) {
                return criteriaBuilder.or(predicates.toArray(new Predicate[0]));
            }
            // Değilse (varsayılan AND), tümünü AND ile bağla
            else {
                return criteriaBuilder.and(predicates.toArray(new Predicate[0]));
            }
        };
    }

    /** Zorunlu alanları kontrol eder; EQUAL dışındaki operasyonlar değer ister */
    private void validate(SearchRequestDto searchDto) {
        if (searchDto.getColumn() == null || searchDto.getColumn().isBlank()) {
            throw new IllegalArgumentException("column alanı zorunludur");
        }
        if (searchDto.getOperation() == null) {
            throw new IllegalArgumentException("operation alanı zorunludur: " + searchDto.getColumn());
        }
        if (searchDto.getValue() == null && searchDto.getOperation() != SearchRequestDto.Operation.EQUAL) {
            throw new IllegalArgumentException(
                    searchDto.getOperation() + " için value zorunludur: " + searchDto.getColumn());
        }
    }

    /** join doluysa ilişkili entity üzerinden, değilse doğrudan root üzerinden alanı bulur */
    @SuppressWarnings("rawtypes")
    private Path<Comparable> getPath(Root<T> root, SearchRequestDto searchDto) {
        String join = searchDto.getJoin();
        try {
            return (join == null || join.isBlank())
                    ? root.get(searchDto.getColumn())
                    : root.join(join).get(searchDto.getColumn());
        } catch (RuntimeException e) {
            String field = (join == null || join.isBlank()) ? searchDto.getColumn() : join + "." + searchDto.getColumn();
            throw new IllegalArgumentException("Geçersiz kolon: " + field, e);
        }
    }

    /** İstekten gelen değeri alanın gerçek Java tipine çevirir (ör. "1000" -> BigDecimal) */
    @SuppressWarnings("rawtypes")
    private Comparable convertValue(Object value, Class<?> type, String column) {
        if (value == null) {
            return null;
        }
        try {
            if (type == Instant.class) {
                return Instant.parse(value.toString());
            }
            return (Comparable) CONVERSION.convert(value, type);
        } catch (ConversionException | DateTimeParseException | ClassCastException e) {
            throw new IllegalArgumentException(
                    "'" + value + "' değeri " + column + " alanı için geçersiz (beklenen tip: " + type.getSimpleName() + ")", e);
        }
    }
}
